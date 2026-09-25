# Architecture

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Agent backend | Node.js + TypeScript + Express | Hosts the LangGraph graph, `/chat` (+ streaming variant) |
| Agent orchestration | LangGraph (`@langchain/langgraph`, TS) | See `03-langgraph-design.md` |
| Admin panel | Next.js + TypeScript | Single-admin auth, no multi-org/billing machinery |
| Widget | Vanilla JavaScript (IIFE bundle, Vite) | Zero dependency, embeds via script tag on any of the client's sites |
| Database | PostgreSQL + pgvector | KB embeddings, keyword (`tsvector`) index, durable LangGraph checkpoints, conversation archive |
| Session/hot-path store | Redis | LangGraph checkpointer's fast backing store for in-progress turns, session TTLs — kept because the team already trusts this pattern from prior work, and per-turn Redis reads/writes are materially cheaper than round-tripping Postgres on every message |
| LLM | Provider-agnostic behind one interface | Model choice not locked in at planning time; keep the provider call behind a single module so switching is contained |
| Embeddings | Provider's embedding model | Same provider-abstraction reasoning as the LLM |
| Document parsing | `docling.rs` (native Node addon, Rust port of IBM's Docling) | No Python subprocess/sidecar — see `02-rag-architecture.md` |

## Site model: single-tenant, multi-site

This is **not** multi-tenant SaaS. There is exactly one client (tenant) per deployment — no self-serve
signup, no per-customer billing, no API-key-per-customer rotation. But that one client may operate
**several distinct web properties**, each needing its own navigation structure, its own branding, and
its own slice of the knowledge base. So the data model keeps a `Site` table as a real, multi-row
entity — just stripped of everything that only exists to support arbitrary multi-tenant SaaS:

- No `ownerId` / registration flow — sites belong to the one implicit deployment, not to an arbitrary
  signed-up customer.
- No per-site API key issuance/rotation UI — a small number of sites, provisioned by the admin, is a
  fundamentally different operational shape than "any customer can create an API key at will."
- No per-site billing/quota.

What each `Site` row does carry: its own allowed origin(s) for CORS/embed validation, its own branding
(name, logo, colors), its own personality/description text, and scopes its own `SiteRoute` rows and
(optionally) its own `KbChunk` rows.

**Knowledge base scoping is hybrid: per-site with an optional global tier.** Most content belongs to
one site (a specific clinic's hours, doctors, services). Some content is genuinely shared across the
whole client's ecosystem (insurance/billing policy, institution-wide FAQs). `KbChunk.siteId` is
**nullable** — null means the chunk is global and every site's retrieval includes it alongside that
site's own chunks. See `04-database-schema.md` for the concrete shape.

Routes are **not** shared this way — `SiteRoute.siteId` is required, because navigation structure is
inherently specific to one property. A user on the urgent-care site being offered a CTA to a page on
the main hospital site's structure would be confusing and is out of scope for v1 (cross-property
navigation, if ever needed, is a deliberate future feature, not an accidental one).

## Widget / embed model

Same embed model as a proven prior system: a zero-dependency vanilla JS IIFE bundle, injected directly
into the host page's DOM (no iframe), embedded via a single script tag. Contract with the host page:

```typescript
window.agentBridge = {
  getCurrentPage: () => string
  navigateTo: (path: string) => void
  getPageContext: () => Record<string, unknown>
  getUserToken: () => string | null   // optional — only relevant if the host page has its own login
}
```

**`getPageContext()` is part of the contract but unused in v1** — `GraphState` (`03-langgraph-design.md`)
has no `pageContext` field yet, and nothing calls this method. Flagging it explicitly rather than
leaving it a silent dead wire: when it does get wired in (likely once a turn needs to know what page
the visitor is currently looking at), apply the lesson from a prior system's version of this feature up
front instead of rediscovering it — **opt-in per site, a hard size cap on what gets captured, and an
optional CSS-selector scope** (so a site can limit capture to its main content area rather than
grabbing the whole page including nav/footer/ads) — not an uncapped whole-page dump by default.

**CORS is wide open at the HTTP layer** (`origin: "*"`) because the widget is embedded on third-party
domains and the browser's CORS preflight can't distinguish "the client's real site" from anywhere
else — but every request is checked server-side against that site's configured allowed origin(s)
(`Origin` header validated against `Site.allowedOrigins`). This is cheap to build correctly here
(a short, admin-managed list per site) where it would have been expensive to retrofit into a system
with unbounded numbers of self-serve tenants — build it in from v1, don't defer it.

## Admin panel scope (v1)

- Single admin login (simple credentials-based auth, one seeded account — no Google OAuth, no
  multi-org registration flow; there's exactly one administrator surface to protect, not "sites
  belonging to different owners").
- Site management: create/edit the client's properties (name, allowed origins, branding, personality).
- Knowledge base: upload/manage documents per site (or mark a document global).
- Route management: CRUD the CTA route list per site.
- Conversation logs: read-only view per site, for support/debugging.

**Any status/loading copy in the widget must be sourced from `Site.personality`, never hardcoded.**
Worth stating explicitly given the first real client here is a healthcare ecosystem: hardcoded
whimsical loading text (the kind that reads as charming on a consumer product) is a real tone mismatch
for a hospital site, and since `Site.personality` already exists as a per-site config field, there's no
reason to hardcode copy that should vary by client in the first place.

**Explicitly not in v1:** a tools tab, a workflow-builder tab, a billing tab, an OpenAPI spec upload
flow, per-site API key rotation UI. All of that exists in the reference system to support arbitrary
third-party site owners self-configuring their own tool integrations — not applicable when there's one
client and no tool-calling yet.

## On-topic handling — minimize the dedicated judgment call

The failure mode to avoid: a standalone "is this on-topic?" classifier field, judged blind on every
turn, that ends up either declining legitimate questions (annoying, breaks trust) or needing repeated
prompt tuning to fix specific misses. Two design choices avoid this:

1. **Retrieval success is the on-topic signal for the common case.** The graph runs knowledge-base
   search and route search *before* any explicit topic judgment. A decent hit from either means the
   turn is on-topic by construction — no separate LLM call needed to confirm what retrieval already
   demonstrated.
2. **A dedicated judgment only runs when both come back empty, and it's biased toward answering.**
   Even then, the default behavior is a soft response ("I don't have specific information on that, but
   here's what I can help with...") rather than a hard decline. A false negative here (mildly
   indulging something borderline) is cheap; a false positive (declining something a real user
   considers obviously legitimate) is what actually damages trust in a client-facing product. Bias the
   fallback toward the cheap mistake.

## Medical-advice redirect — a distinct guardrail, not a topic-scope rule

Because the first client is a healthcare ecosystem: a symptom/diagnosis/medication question is
**on-topic** for a hospital site (it's exactly the kind of thing a patient would ask) but carries real
liability exposure if the bot answers it directly. This is decided as its own axis, separate from
on-topic-ness, and resolved conservatively: **always redirect** ("please consult your doctor" +
optionally a booking CTA), regardless of whether the knowledge base happens to have content that could
answer it. A dedicated `medicalGuard` graph node runs *first*, before retrieval — see
`03-langgraph-design.md` — specifically so a well-covered KB topic can never accidentally override the
redirect by being retrieved and answered from.

## Navigation / CTA design

Routes are searched via the same hybrid retrieval infrastructure as the knowledge base (see
`02-rag-architecture.md`), not listed wholesale in the prompt — a single property in a real healthcare
site can easily have 50-200+ pages (departments, services, doctor bios, locations, insurance, booking
flows), well past what's sane to enumerate in a system prompt on every turn.

Retrieval narrows the full route table down to a handful of candidates (top-k, with a **distance
floor** — below it, nothing qualifies as a match at all, rather than always returning "the nearest
thing however far away it actually is"). A cheap judging step then picks one of three outcomes:

- **One candidate clearly matches** → offer it as a single CTA button, auto-suggested.
- **A few candidates plausibly match** → offer 2-3 as a small button group, let the user pick rather
  than the model guessing wrong between similarly-worded pages.
- **Nothing crosses the floor** → no CTA at all; the turn falls through to a normal knowledge-base
  answer (or the on-topic fallback above, if that also came up empty).

This is the mechanism that makes retrieval-at-scale actually useful: the model's job narrows from
"pick the right page out of 150" to "pick the right page out of up to 5, or say none of these fit,"
which is a fundamentally easier and more reliable judgment.

**CTA attachment is independent of whether the knowledge base also produced an answer — these are not
mutually exclusive outcomes.** An earlier draft of this design modeled "answer from KB" and "offer a
CTA" as branches of the same decision, which breaks on a very ordinary question like "how do I book an
appointment?" — that has both a genuine KB answer (describing how booking works) *and* a matching route
(the booking page itself), and a real user benefits from getting both in one response, not one instead
of the other. So the two are decided separately: whether there's a grounded answer to write is judged
purely from the document search results; whether to attach a CTA is judged purely from the route search
results and the distance floor above. `respond` composes whatever combination applies — text-only,
CTA-only, or both together — in a single response. Phase 3's exit criteria (`06-phased-plan.md`)
explicitly test the combined case for this reason.

**Invariant: a CTA's destination is always a real `SiteRoute` row, never text the model writes.** The
model's job is picking *which* route candidate(s) to surface from what retrieval already found — never
composing a path itself. This is deliberate and worth stating outright so it doesn't erode during
implementation: a navigation suggestion whose destination the model could influence freely is exactly
the failure mode this design is built to avoid (a confident but wrong suggestion, indistinguishable
from a correct one until a visitor clicks it). See `07-api-contracts.md` for how this is enforced in
the actual `ClientAction` shape.

## Guardrail posture (general content safety)

Beyond the medical-advice redirect above (which is a required v1 feature specific to this client's
domain), general prompt-injection/content-safety scanning is **deferred**, built as a pluggable
no-op hook from the start rather than left as a bolt-on later. Add a real scanning provider behind
that hook if/when a specific client's domain calls for it; don't build the scanning infrastructure
speculatively before there's a concrete requirement driving its configuration.

## Production-readiness principles (built in from day 1, not scheduled later)

- **Structured error responses everywhere**, with try/catch around every database/external call from
  the first route written — never a raw stack trace or an unhandled rejection reaching the client.
- **Every LLM and embedding provider call is timeout-bounded.** A prior system originally shipped these
  calls with no timeout at all, and a slow/hung provider response turned into a stuck request with no
  clear failure — cheap to bound from the first call written, expensive to track down once it's live.
- **Basic rate limiting** (per session/IP) on the chat endpoint from the start.
- **Origin allowlisting per site**, enforced server-side on every request (see "Widget / embed model"
  above).
- **Strict env-var discipline** — every configurable value has a corresponding `.env.example` entry
  from the first commit; nothing hardcoded that should be configurable per deployment.
- **Correct internal package resolution from the start** if the monorepo has a shared package —
  point it at source, not a compiled `dist/` that can silently go stale after an edit. Cheap to get
  right on day one, an easy-to-miss gotcha if not decided upfront.
