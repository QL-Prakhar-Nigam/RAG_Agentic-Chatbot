# Basic Setup

## Monorepo layout

npm workspaces, deliberately smaller than a full multi-tenant reference system — no `tool-engine`
package (nothing to generate tools from until tool-calling is actually built), no billing package.

```
rag_chatbot/
├── CLAUDE.md                   ← written once this planning set is reviewed and agreed
├── package.json                ← workspaces root
├── docker-compose.yml           ← Postgres + pgvector, Redis
├── .env / .env.example
├── prisma/                     ← (or equivalent ORM) schema.prisma, migrations
└── packages/
    ├── shared/                 ← shared TS types (ClientAction, GraphState-adjacent types, etc.)
    ├── api/                    ← Express + LangGraph backend
    │   └── src/
    │       ├── graph/          ← nodes, state, graph wiring (03-langgraph-design.md)
    │       ├── kb/             ← ingestion pipeline (docling.rs parser, chunker, embedding)
    │       ├── routes/         ← /chat, /chat/stream, /internal/* (admin → api calls)
    │       └── services/       ← embeddings, retrieval, redis/postgres clients
    ├── admin/                  ← Next.js admin panel
    └── widget/                 ← vanilla JS IIFE bundle (Vite)
```

## Docker Compose

Two services, matching the reference system's proven local-dev setup:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16    # or the current pinned pgvector-enabled Postgres image
    environment:
      POSTGRES_USER: ...
      POSTGRES_PASSWORD: ...
      POSTGRES_DB: ...
    ports: ["5433:5432"]              # non-default host port to avoid clashing with a local Postgres
  redis:
    image: redis:8    # NOT redis:7 — see note below
    ports: ["6379:6379"]
```

**Must be `redis:8`, not plain `redis:7`.** The LangGraph checkpointer used for graph state
(`@langchain/langgraph-checkpoint-redis`, see `03-langgraph-design.md`) needs the RedisJSON and
RediSearch modules to build and query its checkpoint indices. Those ship bundled by default only from
Redis 8.0 onward; a vanilla `redis:7` image lacks them entirely, and `RedisSaver.setup()` fails against
it outright rather than degrading gracefully. (On an older pinned Redis version, `redis/redis-stack` is
the equivalent fix — but there's no reason to pin below 8 here.) This is not the same requirement a
plain `ioredis` session-store usage would have — don't assume a prior system's Redis usage transfers
just because it's "the same database."

An `init.sql` (or equivalent first migration) runs `CREATE EXTENSION IF NOT EXISTS vector;` before
anything else touches the `KbChunk`/`SiteRoute` embedding columns.

## Tooling

| Concern | Choice | Why |
|---|---|---|
| Backend runtime | Node.js + TypeScript | Matches `docling.rs`'s native addon target and LangGraph's TS SDK |
| API framework | Express | Simple, well-understood, no reason to deviate for this scope |
| Admin panel | Next.js | File-based routing, easy to keep small given the reduced v1 admin scope |
| Widget bundler | Vite (IIFE output) | Single-file output, matches the zero-dependency embed requirement |
| ORM | Prisma (or equivalent) | `Unsupported(...)` column types needed either way for `vector`/`tsvector` — whichever ORM is chosen, hand-written migration SQL is unavoidable for those two column types |
| Tests | Vitest | Fast, consistent across packages |
| Package manager | npm workspaces | Matches the monorepo layout above; no reason to add a heavier tool (pnpm/turborepo) at this scale |

**`docling.rs` platform note:** prebuilt native binaries exist for Linux x64/arm64 and Windows x64
only. Production/CI (Linux containers) is unaffected, but a Mac-based developer's first
`npm install` will stall on a from-source compile unless a local Rust toolchain is already installed —
worth a line in the repo's own README/onboarding, not just here.

## Env-var discipline

Every configurable value gets a `.env.example` entry from the first commit — database URL, Redis URL,
LLM/embedding provider keys, admin session secret, and (per site, likely stored in the DB rather than
env once the admin panel exists) allowed origins. Nothing hardcoded that should vary per deployment —
this is the actual mechanism that keeps the architecture hosting-model-agnostic (see
`01-architecture.md`'s open question on vendor-hosted vs. client-hosted): a deployment is fully
described by its env vars + DB config, not by anything baked into the code.

## One turn function, two transports

`/chat` (Phase 1) and `/chat/stream` (Phase 4) must call the same internal function for the actual
graph invocation — only the transport differs (buffered JSON response vs. SSE). Writing them as two
independently-maintained handlers is exactly how a prior system's two chat routes drifted from each
other over time. Structure it as one `runTurn(state)` function that both route handlers call; the
streaming route's only extra job is forwarding the graph's native streaming output as SSE events.

## CI / lint baseline

Set up from the first commit, not added later: typecheck + test run on every push, consistent
formatting (Prettier or equivalent), and the same "mock all external I/O in tests" discipline the RAG
ingestion/retrieval code will need anyway (LLM calls, embedding calls, `docling.rs` calls all mocked at
their module boundary in unit tests — real-document verification is a separate, manual step, not
something unit tests can meaningfully cover for a parsing library).
