# RAG_CHATBOT

Single-tenant, multi-site agentic RAG chatbot, sold with source to one healthcare client. Full design
rationale lives in `local/planning/` (`00-overview.md` through `07-api-contracts.md`) — read those
before making architectural changes. This file is a working summary of the decisions that must not
silently erode during implementation.

## Stack

Node.js + TypeScript + Express (agent backend, LangGraph) · Next.js (admin panel) · vanilla JS IIFE
(widget, Vite) · PostgreSQL + pgvector · Redis (LangGraph checkpointer) · OpenAI (chat + embeddings,
`gpt-4o-mini` / `text-embedding-3-small`, behind a provider-agnostic interface) · `docling.rs` for
document parsing/chunking · Prisma ORM (hand-written migrations for `vector`/`tsvector` columns) · npm
workspaces.

## Load-bearing invariants — do not casually change these

- **One client, several `Site` rows.** Not multi-tenant SaaS — no `ownerId`, no per-site billing/API-key
  rotation. `KbChunk.siteId` is nullable (null = global, visible to every site). `SiteRoute.siteId` is
  required (routes are never global).
- **Every query touching `KbChunk`, `SiteRoute`, or conversation data must filter by `siteId`** (except
  the deliberate global-`KbChunk` case above).
- **`medicalGuard` runs before retrieval**, via a conditional edge, and short-circuits straight to a
  canned redirect. A well-covered KB topic must never be able to override it.
- **On-topic judgment is retrieval-driven, not a dedicated classifier call.** A separate judgment only
  runs when both KB search and route search come up empty, and it's biased toward a soft fallback, never
  a hard decline.
- **`responseMode` (KB answer) and `ctaCandidates` (navigation) are independent decisions**, composed
  together by `respond`. Never model them as branches of one combined decision — "how do I book an
  appointment?" needs both a real answer and a CTA in the same response.
- **A `navigate` action's `path` always comes from a `SiteRoute` row — never text the model writes.**
- **LangGraph checkpointer is Redis-only in v1** (ephemeral, fine because nothing uses `interrupt()`
  yet). Postgres's `ConversationLog` is a separate, application-level archive, not a second checkpointer
  backend. Swapping to a durable checkpointer is real, scoped Phase 8 work when multi-step flows land —
  not a side effect of adding a node.
- **Redis must be `redis:8`, not `redis:7`** — the LangGraph Redis checkpointer needs RedisJSON/RediSearch,
  bundled only from 8.0 onward.
- **CORS is wide open (`origin: "*"`) at the HTTP layer**; every request is instead validated
  server-side against that `Site`'s `allowedOrigins` (Phase 4).
- **`/chat` and `/chat/stream` call one shared `runTurn(state)` function** — never two independently
  maintained handlers.
- **Structured responses (Phase 6) are display-only, no per-item actions**, until a specific site's data
  demonstrably has a real per-item destination.
- **Production-readiness is built in per route, not retrofitted**: try/catch + structured error
  responses, timeout-bounded provider calls, per-session/IP rate limiting, origin allowlisting, strict
  `.env.example` discipline.
- **`@rag-chatbot/shared` resolves to its TS source** (`main`/`types` point at `src/index.ts`, not a
  built `dist/`) — see `01-architecture.md`'s package-resolution principle. Next.js needs
  `transpilePackages` for this (already set in `packages/admin/next.config.mjs`); `tsx` (api's dev/CLI
  scripts) resolves it natively. **Not yet solved: production `node dist/index.js`** (plain Node, no
  loader) can't execute a `.ts` file — a real build step for workspace packages is needed before
  `packages/api`'s `build`/`start` scripts are actually deployable. Revisit before Phase 7 or first
  deploy, whichever comes first.
- **The hybrid chunker's tokenizer is checked into the repo** at `packages/api/models/chunk-tokenizer.json`
  (all-MiniLM-L6-v2's, ~0.5MB from `docling.rs`'s own model-download script) and referenced by an
  absolute path in `kb/parse.ts` — deliberately not cwd-relative, and small enough not to need the
  fetch-at-install pattern the PDF/OCR ONNX models use. PDF/image ingestion isn't wired up yet — that
  needs the separate (large) ONNX model download `docling.rs`'s README describes, not done in Phase 1.
- **`/internal/sites` and `/internal/documents` have no auth** (Phase 1.5) — a deliberate, discussed
  choice, not an oversight, closed by Phase 5's real admin auth applied on top of these same endpoints.
  Must not be reachable from anywhere but local dev until then.

## Repo layout

```
packages/
  shared/   ← shared TS types (ClientAction, ChatRequest/Response, ...)
  api/      ← Express + LangGraph backend (src/graph, src/kb, src/routes, src/services)
  admin/    ← Next.js admin panel
  widget/   ← vanilla JS IIFE embed (Vite)
prisma/     ← schema.prisma + hand-written migrations (vector/tsvector columns)
```

## Implementation phases

See `local/planning/06-phased-plan.md` for full detail and exit criteria.

0. Repo scaffold — done
1. RAG core (ingestion, hybrid retrieval, eval harness, minimal `retrieve → respond` graph) — done
   1.5. Minimal admin slice (site create + doc upload, no auth — pulled forward from Phase 5) — **current phase**
2. Medical-advice guardrail + on-topic fallback
3. Navigation CTAs
4. Widget embed polish, streaming
5. Admin panel (auth + everything 1.5 didn't cover: route mgmt, conversation logs, site edit/branding)
6. Structured responses (deprioritized)
7. Hardening pass
8. Future: tool-calling, multi-step `interrupt()` flows, billing — not scheduled

## Local dev

```
docker compose up -d        # Postgres+pgvector on :5434, Redis on :6380 (ports picked to avoid
                             # collisions with other projects on shared dev machines)
cp .env.example .env         # already present in this repo for local dev
npx prisma migrate dev
npm install
npm run dev:api              # Express on :4001
npm run dev:admin            # Next.js on :3000 — create sites + upload documents here (Phase 1.5)

# eval harness — no admin UI for this yet
npm run eval --workspace=packages/api -- <siteId>   # recall@k / MRR against that site's golden set

# CLI ingestion still works too (useful for scripting), but the admin UI is the easier path now
npm run ingest --workspace=packages/api -- <filePath> [siteId]
```

Both need a real `OPENAI_API_KEY` in `.env` (embeddings + batched enrichment/generation all go through
OpenAI). Set `OPENAI_BASE_URL` to point at a compatible mock/gateway instead if you need to exercise the
pipeline without burning real API calls.
