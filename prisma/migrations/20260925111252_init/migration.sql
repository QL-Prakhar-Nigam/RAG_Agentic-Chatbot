-- Prisma can't express `vector`/`tsvector` columns natively (see
-- local/planning/04-database-schema.md) — this migration is hand-edited after
-- `prisma migrate dev --create-only` to add them. Must run before anything
-- else touches the KbChunk/SiteRoute embedding columns.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allowedOrigins" TEXT[],
    "agentName" TEXT,
    "agentLogoUrl" TEXT,
    "brandColor" TEXT,
    "personality" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbDocument" (
    "id" TEXT NOT NULL,
    "siteId" TEXT,
    "fileName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KbDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "siteId" TEXT,
    "content" TEXT NOT NULL,
    "sectionPath" TEXT,
    "summary" TEXT,
    "hypotheticalQuestions" JSONB,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" vector(1536),
    "searchVector" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("content", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("sectionPath", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("summary", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("hypotheticalQuestions"::text, '')), 'C')
    ) STORED,

    CONSTRAINT "KbChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteRoute" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(1536),

    CONSTRAINT "SiteRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationLog" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "agentMessage" TEXT NOT NULL,
    "clientActions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KbDocument_siteId_idx" ON "KbDocument"("siteId");

-- CreateIndex
CREATE INDEX "KbChunk_siteId_idx" ON "KbChunk"("siteId");

-- CreateIndex
CREATE INDEX "KbChunk_documentId_idx" ON "KbChunk"("documentId");

-- CreateIndex
CREATE INDEX "SiteRoute_siteId_idx" ON "SiteRoute"("siteId");

-- CreateIndex
CREATE INDEX "ConversationLog_siteId_idx" ON "ConversationLog"("siteId");

-- CreateIndex
CREATE INDEX "ConversationLog_sessionId_idx" ON "ConversationLog"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex (keyword search — 02-rag-architecture.md hybrid retrieval)
CREATE INDEX "KbChunk_searchVector_idx" ON "KbChunk" USING GIN ("searchVector");

-- CreateIndex (vector search — HNSW, cosine distance; no pre-existing data needed to tune, unlike ivfflat)
CREATE INDEX "KbChunk_embedding_idx" ON "KbChunk" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "SiteRoute_embedding_idx" ON "SiteRoute" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "KbDocument" ADD CONSTRAINT "KbDocument_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbChunk" ADD CONSTRAINT "KbChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KbDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbChunk" ADD CONSTRAINT "KbChunk_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteRoute" ADD CONSTRAINT "SiteRoute_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationLog" ADD CONSTRAINT "ConversationLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
