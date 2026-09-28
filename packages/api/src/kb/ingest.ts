import path from "node:path";
import { prisma } from "../services/prisma.js";
import { embedTexts } from "../services/embeddings.js";
import { parseAndChunk } from "./parse.js";
import { enrichChunks } from "./enrich.js";

export interface IngestDocumentInput {
  /** null = uploaded as a global/shared document (local/planning/01-architecture.md). */
  siteId: string | null;
  filePath: string;
  fileName?: string;
}

export interface IngestDocumentResult {
  documentId: string;
  chunkCount: number;
}

// Keeps each embeddings.create call within a sane request size for large documents.
const EMBED_BATCH_SIZE = 100;

// Full pipeline: parse+chunk → batched enrichment → embed → persist.
// See local/planning/02-rag-architecture.md for the design of each step.
export async function ingestDocument(input: IngestDocumentInput): Promise<IngestDocumentResult> {
  const fileName = input.fileName ?? path.basename(input.filePath);

  const chunks = await parseAndChunk(input.filePath);
  if (chunks.length === 0) {
    throw new Error(`No chunks produced for ${fileName} — nothing to ingest`);
  }

  const enrichments = await enrichChunks(chunks);
  const enrichmentByIndex = new Map(enrichments.map((e) => [e.chunkIndex, e]));

  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const vectors = await embedTexts(batch.map((c) => c.contextualized));
    embeddings.push(...vectors);
  }

  const document = await prisma.kbDocument.create({
    data: { siteId: input.siteId, fileName },
  });

  for (const chunk of chunks) {
    const enrichment = enrichmentByIndex.get(chunk.chunkIndex);
    const embedding = embeddings[chunk.chunkIndex];
    const vectorLiteral = `[${embedding.join(",")}]`;

    // Prisma's Unsupported("vector")/Unsupported("tsvector") columns can't go
    // through the generated client's create()/update() — raw SQL is the only
    // path for the embedding column (searchVector is a generated column and
    // fills itself). See local/planning/04-database-schema.md.
    await prisma.$executeRaw`
      INSERT INTO "KbChunk"
        (id, "documentId", "siteId", content, "sectionPath", summary, "hypotheticalQuestions", "chunkIndex", embedding)
      VALUES
        (${crypto.randomUUID()}, ${document.id}, ${input.siteId}, ${chunk.text}, ${chunk.sectionPath},
         ${enrichment?.summary ?? ""}, ${JSON.stringify(enrichment?.questions ?? [])}::jsonb,
         ${chunk.chunkIndex}, ${vectorLiteral}::vector)
    `;
  }

  return { documentId: document.id, chunkCount: chunks.length };
}
