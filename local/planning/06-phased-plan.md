# Phased Implementation Plan

Ordered so that "give correct, well-grounded plain-text answers" is proven before anything else is
layered on — structured responses (tables/cards) are explicitly deprioritized until RAG and navigation
are solid, per direct product guidance.

## Phase 0 — Repo scaffold

- Monorepo structure (`05-setup.md`), Docker Compose (Postgres+pgvector, Redis), `.env.example`.
- CI baseline: typecheck + test on every push.
- `CLAUDE.md` written from this planning set, checked in.
- **Exit criteria:** `docker-compose up`, a migration runs cleanly, an empty Express server boots, an
  empty Next.js admin app boots.

## Phase 1 — RAG core

- Ingestion pipeline (`02-rag-architecture.md`): `docling.rs` parsing, its hybrid chunker, batched
  enrichment (summary + hypothetical questions), contextual embeddings.
- Hybrid retrieval: pgvector + `tsvector` + RRF merge.
- Eval harness: recall@k / MRR against the ingestion-time hypothetical-questions golden set.
- A minimal LangGraph graph: `retrieve → respond` only (no `medicalGuard`, no `navigateCandidates`
  yet) — prove the core retrieval-to-answer loop end-to-end before adding the other nodes.
- A bare `/chat` endpoint (non-streaming first), matching the request/response contract in
  `07-api-contracts.md`.
- **Exit criteria:** uploading a real document through the pipeline and asking a question about it
  returns a grounded answer; eval harness runs and reports numbers (even if not yet tuned against).

## Phase 1.5 — Minimal admin slice (pulled forward from Phase 5)

Not in the original ordering — pulled forward mid-Phase-1 because testing every subsequent phase by
hand-inserting `Site` rows via `psql` and uploading documents via a CLI script was real, avoidable
friction for whoever is verifying each phase. Only the two pieces that unblock that: creating a site and
uploading a document to it. Everything else that belongs to the admin panel (auth, route management, the
conversation log viewer, branding/personality editing) stays in Phase 5, not duplicated or foreshadowed
here.

- `GET`/`POST /internal/sites`, `GET`/`POST /internal/documents` (multipart upload, wired to the
  existing ingestion pipeline) — see `07-api-contracts.md`.
- A minimal Next.js dashboard: create a site, see its `siteId` (copyable, not something to go dig out of
  Postgres), upload a document to it or as a global document, see what's already been uploaded.
- **Explicitly no auth on these endpoints** — a deliberate, discussed choice (not an oversight), closed
  by Phase 5's real admin auth. Must not be reachable from anywhere but local dev until then.
- **Exit criteria:** an admin can create a site and upload a document through the browser, without
  touching SQL or the CLI.

## Phase 2 — Medical-advice guardrail + on-topic fallback

- `medicalGuard` node, wired first in the graph per `03-langgraph-design.md`.
- The on-topic fallback behavior described in `01-architecture.md` (soft response when retrieval finds
  nothing, not a hard decline).
- **Exit criteria:** a symptom/medication-shaped question is redirected regardless of KB content; a
  genuinely off-topic question gets a soft fallback, not silence or an error.

## Phase 3 — Navigation CTAs

- `SiteRoute` table + embedding-based route search with a distance floor.
- `navigateCandidates` node + `decide` node's tiered single/branch/none logic — `ctaCandidates` decided
  independently of `responseMode` (`03-langgraph-design.md`), not as branches of one combined decision.
- Widget renders a single CTA button and a small multi-option button group.
- **Exit criteria:** a request matching one clear route gets a single CTA; a request matching a few
  plausible routes gets a button group; a request matching nothing gets neither, cleanly; **and —
  explicitly, not just implied by the above — a request with both a good KB answer and a matching route
  (e.g. "how do I book an appointment?") returns a full text answer AND a CTA in the same response, not
  one instead of the other.**

## Phase 4 — Widget embed polish

- Script-tag embed, `agentBridge` contract, CORS + per-site origin allowlist enforcement.
- Basic branding (name/logo/color pulled from `Site`).
- Streaming (`/chat/stream`, SSE) — see `03-langgraph-design.md`.
- **Exit criteria:** the widget embeds cleanly on a real test page for a configured site, respects that
  site's allowed origins, and streams responses.

## Phase 5 — Admin panel

Site creation and document upload already exist from Phase 1.5 — this phase adds auth in front of them
(closing that phase's deliberately-left-open gap) plus everything that didn't make sense to pull
forward early.

- Single-admin auth — applied to the Phase 1.5 endpoints too, not just new ones.
- Site management: edit (not just create) — properties, origins, branding.
- Knowledge base upload/management: document delete, "mark as global" toggle (Phase 1.5 only supports
  choosing global vs. per-site at upload time, not changing it after).
- Route management (CRUD).
- Conversation log viewer (read-only).
- **Exit criteria:** an admin can, without touching the database directly, create a new site, upload a
  document to it, add routes, and see conversation history.

## Phase 6 — Structured responses (deprioritized, after the above are solid)

- One layout-discriminated response block (list / cards / table), **display-only** — no per-item
  actions in this first version. A prior system built per-item actions first and had to remove them
  once it became clear most retrieved data had no real per-item destination to link to, and a button
  that silently goes to the wrong place is a worse failure than no button at all. Start without them;
  add only once a specific site's data demonstrably has a real per-item destination.
- **Exit criteria:** a query whose answer is naturally a list of records (e.g. "what services does the
  cardiology department offer") renders as a structured block instead of a wall of prose.

## Phase 7 — Hardening pass

- Rate limiting audit (confirm it's actually applied everywhere it should be, not just where it was
  first added).
- Error-handling audit (every route has try/catch, no raw error leakage).
- Optional vendor-side observability hook (off by default — see `00-overview.md`'s open hosting-model
  question).
- **Exit criteria:** a deliberate error injected into any route returns a structured error response,
  never a raw stack trace or an empty body.

## Phase 8+ — Future, not scheduled yet

- Tool-calling node (`03-langgraph-design.md`'s extension path) — once a client need actually requires
  the bot to take an action, not just answer/navigate.
- Multi-step agentic flows using `interrupt()`/checkpoint resume — form-collection, confirmation
  flows, anything requiring a pause-and-resume turn shape.
- Anything billing-related — explicitly out of scope until there's a decided sales/licensing model
  (see `00-overview.md`'s open questions).
