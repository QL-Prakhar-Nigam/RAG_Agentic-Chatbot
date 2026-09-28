import { prisma } from "../services/prisma.js";
import { embedText } from "../services/embeddings.js";
import { reciprocalRankFusion, type RankedResult } from "./rrf.js";
import type { KbSearchResult } from "./types.js";

export const TOP_K = 8;
// Each individual signal over-fetches past TOP_K so RRF has enough candidates
// from both lists to actually reward agreement between them.
const CANDIDATE_K = 20;

interface RawRow {
  id: string;
  content: string;
  sectionPath: string | null;
  summary: string | null;
  documentId: string | null;
}

async function vectorSearch(
  siteId: string,
  queryEmbedding: number[],
  limit: number
): Promise<RawRow[]> {
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  return prisma.$queryRaw<RawRow[]>`
    SELECT id, content, "sectionPath", summary, "documentId"
    FROM "KbChunk"
    WHERE ("siteId" = ${siteId} OR "siteId" IS NULL) AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `;
}

async function keywordSearch(siteId: string, queryText: string, limit: number): Promise<RawRow[]> {
  return prisma.$queryRaw<RawRow[]>`
    SELECT id, content, "sectionPath", summary, "documentId"
    FROM "KbChunk"
    WHERE ("siteId" = ${siteId} OR "siteId" IS NULL)
      AND "searchVector" @@ websearch_to_tsquery('english', ${queryText})
    ORDER BY ts_rank("searchVector", websearch_to_tsquery('english', ${queryText})) DESC
    LIMIT ${limit}
  `;
}

// [pluggable, currently a no-op] — see local/planning/02-rag-architecture.md.
// Reranking is the one piece with a real per-query recurring cost; wait for
// eval-harness evidence that RRF-only ordering isn't good enough before
// paying for it.
async function rerank(_query: string, candidates: KbSearchResult[]): Promise<KbSearchResult[]> {
  return candidates;
}

// Hybrid retrieval: vector + keyword search over this site's chunks plus
// global (siteId IS NULL) chunks, merged via RRF. See
// local/planning/02-rag-architecture.md.
export async function searchKb(siteId: string, queryText: string): Promise<KbSearchResult[]> {
  const queryEmbedding = await embedText(queryText);

  const [vectorRows, keywordRows] = await Promise.all([
    vectorSearch(siteId, queryEmbedding, CANDIDATE_K),
    keywordSearch(siteId, queryText, CANDIDATE_K),
  ]);

  const toRanked = (rows: RawRow[]): RankedResult<RawRow>[] =>
    rows.map((row) => ({ id: row.id, item: row }));

  const fused = reciprocalRankFusion([toRanked(vectorRows), toRanked(keywordRows)]);

  const merged: KbSearchResult[] = fused.map(({ item, score }) => ({
    chunkId: item.id,
    content: item.content,
    sectionPath: item.sectionPath,
    summary: item.summary,
    documentId: item.documentId,
    score,
  }));

  const reranked = await rerank(queryText, merged);
  return reranked.slice(0, TOP_K);
}
