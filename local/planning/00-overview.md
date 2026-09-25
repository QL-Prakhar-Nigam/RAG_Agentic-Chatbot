# RAG_CHATBOT — Planning Overview

## What this is

A **single-tenant, multi-site** agentic chatbot product, sold to a client with the source code (not
hosted multi-tenant SaaS). One deployment serves one client, who may operate **several distinct web
properties** (e.g. a healthcare ecosystem with a main hospital site, an urgent-care site, a specialty
clinic site, a patient portal). Each property gets its own embeddable widget, its own navigation
structure, and its own knowledge base slice, but they all share one deployment, one admin panel, one
database.

**v1 scope:** RAG (knowledge-base Q&A), navigation via CTA buttons, and a medical-advice redirect
guardrail (client is a healthcare ecosystem — see `01-architecture.md`). Structured responses
(tables/cards) are explicitly lower priority — get plain-text answers right first. Tool-calling and
multi-step agentic workflows are **not built now but the graph is structured so they slot in later
without redesigning it** — that is the whole reason LangGraph was chosen from day one instead of a
hand-rolled loop. One caveat worth stating up front rather than discovering later: this "no redesign"
property holds for the *graph's shape* (new nodes, new edges), not for everything underneath it — the
v1 persistence layer is deliberately simple (an ephemeral Redis-only checkpointer, since nothing pauses
mid-turn yet) and swapping to a durable one for future multi-step flows is real migration work, done
when it's actually needed. See `03-langgraph-design.md`.

## Why this is a separate repo, not a fork

The reference system this was designed against is a full multi-tenant SaaS platform (arbitrary
customer signup, per-tenant billing, a large admin dashboard with tools/workflow-builder UI, OpenAPI
spec upload, quota enforcement). None of that applies here — one client, no self-serve signup, no
billing. Forking that system and stripping features out would carry over a lot of structure that
exists only to solve multi-tenant SaaS problems this product doesn't have. This repo is built smaller
and more deliberately instead, picking up specific patterns that proved out (hybrid RAG retrieval,
the widget's zero-dependency embed model, structured error handling discipline) and deliberately
avoiding specific mistakes documented below, without carrying the SaaS machinery.

## Core design philosophy

**LLM calls stay narrow and single-purpose. The graph structure carries the decision logic, not one
large classifier call.** A generative model asked to output five independent judgments in one JSON
response (intent, clarify-or-not, on-topic-or-not, which workflow, an objective string) is a single
point of failure that's expensive to debug when it's subtly wrong on one field. LangGraph lets each
node own exactly one decision, wired together by conditional edges — see `03-langgraph-design.md` for
the concrete graph.

**Retrieval evidence drives decisions wherever possible, instead of asking the model to judge blind.**
The clearest example: instead of a dedicated "is this on-topic?" classifier call running on every
turn, retrieval runs first — if it finds relevant knowledge-base content or a matching navigation
route, the turn is on-topic by construction. A separate judgment call only happens on the rare turn
where both come up empty. Fewer classifier calls, fewer chances to misfire, less tuning surface.

**Production-readiness (structured error handling, rate limiting, origin allowlisting, env-var
discipline) is built in from the first route written, not scheduled as a later "hardening phase."**
A system built by a prior team took this approach — features shipped first, hardening scheduled for
later — and several of those hardening items were still open a year into the project (no request rate
limiting, no domain allowlist, at least one route with no error handling that leaked raw stack traces
via an empty response body). Cheap to build in from the start; expensive to retrofit once traffic and
surface area both exist.

## Document index

| Doc | Covers |
|---|---|
| `01-architecture.md` | Overall system architecture — stack, Site model, widget/embed model, admin panel scope, on-topic design, navigation/CTA design, guardrail posture, what's explicitly out of scope for v1 |
| `02-rag-architecture.md` | Structure-aware ingestion, hybrid (vector+keyword) retrieval, RRF merging, eval harness, cost notes |
| `03-langgraph-design.md` | Graph state shape, node wiring, checkpointing (Redis + Postgres), streaming, how tool-calling/multi-step flows slot in later |
| `04-database-schema.md` | Concrete schema — Site, KbChunk, SiteRoute, conversation logs, admin users; Redis key namespace |
| `05-setup.md` | Monorepo layout, Docker Compose, tooling choices, env-var discipline |
| `06-phased-plan.md` | Implementation phases, in priority order, each with concrete deliverables |
| `07-api-contracts.md` | The `/chat` request/response shape and the `ClientAction` union — concrete, not just implied |

## Open decisions, not yet resolved

- **Hosting model** — whether the vendor hosts each client's deployment or the client self-hosts is
  still undecided. The architecture is deliberately built to not depend on the answer: all per-site
  config lives in the database or env vars (never hardcoded), and any vendor-side observability
  (centralized error/usage visibility) is an optional, off-by-default hook rather than a hard
  dependency — see `01-architecture.md`.
- **Update/versioning strategy across client deployments** — once this ships to a first client and the
  template improves, how do fixes reach existing deployments (a private template repo with scripted
  sync, per-client git forks merged from upstream, something else)? Not yet decided; worth resolving
  before a second client deployment exists, since drift compounds after that.
- **License/IP protection mechanism** (if any — a license key, a kill switch, none at all) — a business
  decision with a technical consequence, deferred until the sales/licensing model is actually decided.
