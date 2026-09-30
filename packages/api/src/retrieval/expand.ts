import { prisma } from "../services/prisma.js";
import type { ExpandedChunk, KbSearchResult } from "./types.js";

// chunkIndex ± this window gets pulled in as surrounding context — starting
// value, widen only once eval evidence shows ±1 isn't enough. See
// local/planning/02-rag-architecture.md.
export const NEIGHBOR_WINDOW = 1;

interface NeighborRow {
  id: string;
  content: string;
  sectionPath: string | null;
  chunkIndex: number;
}

async function fetchNeighbors(documentId: string, indexes: number[]): Promise<NeighborRow[]> {
  if (indexes.length === 0) {
    return [];
  }
  return prisma.$queryRaw<NeighborRow[]>`
    SELECT id, content, "sectionPath", "chunkIndex"
    FROM "KbChunk"
    WHERE "documentId" = ${documentId} AND "chunkIndex" = ANY(${indexes}::int[])
  `;
}

// Small-to-big expansion: pulls each matched chunk's immediate document
// neighbors in as supporting context, tagged separately from the actual
// match (source: "expanded" vs "retrieved") so a neighbor is never treated
// as an independent search hit. Deliberately lives here, not inside
// searchKb — see the plan's "expansion lives in retrieveNode" note: the eval
// harness calls searchKb directly, and folding expansion into it would let a
// neighbor that happens to be the golden chunk count as a recall hit even
// when real ranking never found it.
export async function expandChunks(matches: KbSearchResult[]): Promise<ExpandedChunk[]> {
  const claimed = new Set<string>();
  const result: ExpandedChunk[] = [];

  // Group matches by document so each document is queried once, not once per
  // match — a top-8 rarely spans more than a handful of documents.
  const byDocument = new Map<string, KbSearchResult[]>();
  for (const match of matches) {
    // Defensive: a real ingested chunk always has a documentId; a chunk
    // without one (shouldn't happen) can't be expanded, so it's kept as-is.
    if (!match.documentId) {
      continue;
    }
    const group = byDocument.get(match.documentId) ?? [];
    group.push(match);
    byDocument.set(match.documentId, group);
  }

  for (const match of matches) {
    if (claimed.has(match.chunkId)) {
      continue;
    }
    claimed.add(match.chunkId);
    result.push({
      chunkId: match.chunkId,
      documentId: match.documentId ?? "",
      chunkIndex: match.chunkIndex,
      content: match.content,
      sectionPath: match.sectionPath,
      source: "retrieved",
      matchedChunkId: match.chunkId,
      retrievalScore: match.score,
    });
  }

  for (const [documentId, docMatches] of byDocument) {
    const neededIndexes = new Set<number>();
    for (const match of docMatches) {
      for (let offset = -NEIGHBOR_WINDOW; offset <= NEIGHBOR_WINDOW; offset++) {
        if (offset !== 0) {
          neededIndexes.add(match.chunkIndex + offset);
        }
      }
    }

    const neighbors = await fetchNeighbors(documentId, [...neededIndexes]);
    const neighborByIndex = new Map(neighbors.map((n) => [n.chunkIndex, n]));

    // Process matches in their existing rank order so a neighbor shared by
    // two nearby matches is claimed by the higher-ranked one, never
    // duplicated into both clusters.
    for (const match of docMatches) {
      for (let offset = -NEIGHBOR_WINDOW; offset <= NEIGHBOR_WINDOW; offset++) {
        if (offset === 0) {
          continue;
        }
        const neighbor = neighborByIndex.get(match.chunkIndex + offset);
        if (!neighbor || claimed.has(neighbor.id)) {
          continue;
        }
        claimed.add(neighbor.id);
        result.push({
          chunkId: neighbor.id,
          documentId,
          chunkIndex: neighbor.chunkIndex,
          content: neighbor.content,
          sectionPath: neighbor.sectionPath,
          source: "expanded",
          matchedChunkId: match.chunkId,
          retrievalScore: null,
        });
      }
    }
  }

  return result;
}
