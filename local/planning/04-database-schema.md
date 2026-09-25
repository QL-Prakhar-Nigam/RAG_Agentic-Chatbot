# Database Schema

Postgres + pgvector, one database for the whole deployment (single tenant — no cross-tenant isolation
concern the way a multi-tenant system would have). `Site`-scoping still matters *within* that one
tenant, though — a query that forgets to filter by `siteId` can leak one property's content into
another's responses, which is exactly the kind of bug worth guarding against with a hard rule from day
one: **every query touching `KbChunk`, `SiteRoute`, or conversation data must filter by `siteId`**
(with the deliberate exception of global `KbChunk` rows — see below).

## Core tables

### `Site`

One row per client property (main hospital site, urgent-care site, specialty clinic, patient portal,
...). No `ownerId` — every site belongs to the one implicit tenant this deployment serves.

```
id                String   @id
name              String
allowedOrigins    String[]           // CORS/embed validation — see 01-architecture.md
agentName         String?
agentLogoUrl      String?
brandColor        String?
personality       String?            // short product-description text fed to the model as context
createdAt         DateTime @default(now())
```

### `KbDocument`

```
id          String    @id
siteId      String?              // null = uploaded as a global/shared document
site        Site?     @relation(...)
fileName    String
sourceUrl   String?              // original file, if object storage is configured
createdAt   DateTime  @default(now())
```

### `KbChunk`

```
id                     String    @id
documentId             String?
document               KbDocument? @relation(...)
siteId                 String?               // NULL = global chunk, visible to every site's retrieval
content                String                // chunk's own text
sectionPath            String?               // heading hierarchy, from docling.rs's chunker
summary                String?               // batched-enrichment output — keyword index only, not embedded
hypotheticalQuestions  Json?                 // string[] — keyword index only; also the eval harness's golden set
embedding              Unsupported("vector(1536)")   // dimension depends on the chosen embedding model
searchVector           Unsupported("tsvector")       // generated column: content + sectionPath + summary + questions
chunkIndex             Int
```

`siteId` nullable is the load-bearing detail here — see `01-architecture.md`'s "hybrid" KB-scoping
decision. Retrieval for a given site's widget queries `WHERE siteId = :siteId OR siteId IS NULL`.

`searchVector` is a Postgres generated column (`GENERATED ALWAYS AS (...) STORED`), GIN-indexed, built
from the same fields listed in `02-rag-architecture.md`'s ingestion pipeline. Prisma (if used as the
ORM) can't express `tsvector`/`GENERATED` natively — same as `vector(1536)` — so this column is
created via a hand-written migration, not the ORM's own schema push.

### `SiteRoute`

```
id          String   @id
siteId      String              // required — routes are per-property, never global
site        Site     @relation(...)
path        String
label       String
embedding   Unsupported("vector(1536)")   // "{label} {path}" embedded, same as KbChunk's pattern
createdAt   DateTime @default(now())
```

### `ConversationLog`

```
id            String   @id
siteId        String
sessionId     String
userMessage   String
agentMessage  String
clientActions Json?              // CTA / structured-response actions returned that turn
createdAt     DateTime @default(now())
```

Written from the durable (Postgres) side of the dual-store design in `03-langgraph-design.md` — the
admin panel's conversation log view reads from here, not from Redis.

### `AdminUser`

```
id            String   @id
email         String   @unique
passwordHash  String
createdAt     DateTime @default(now())
```

Deliberately minimal — simple credentials auth, no OAuth provider, no per-site ownership (any admin
account can manage any site, since there's one tenant). Add role-based restriction later only if a
real need for multiple admin accounts with different scopes actually shows up.

### LangGraph checkpoint tables

Managed by whichever LangGraph checkpointer implementation is used for the durable (Postgres) side of
persistence — table shape is defined by that library, not hand-designed here. Don't create custom
tables that duplicate what the checkpointer already provides.

## Redis key namespace

Mirrors a proven pattern from prior work — namespaced by site and session so cross-property collision
is structurally impossible even before any other check runs:

```
chat:{siteId}:{sessionId}         → LangGraph checkpointer's hot-path state for this thread
ratelimit:{siteId}:{ip-or-session} → rate limiting counters (see 01-architecture.md)
```

TTL on both — conversation state doesn't need to live in Redis forever; the durable archive is
Postgres's job (`ConversationLog` above).
