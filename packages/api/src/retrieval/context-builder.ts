import type { ExpandedChunk } from "./types.js";

// Starting value, not yet tuned — see NEIGHBOR_WINDOW's note in expand.ts.
// A rough character budget rather than a real token count: good enough to
// keep prompt size bounded once expansion can multiply the chunk count.
export const CONTEXT_CHAR_BUDGET = 12000;

// Groups expanded chunks into one cluster per matched chunk (preserving the
// original retrieval rank as cluster order), orders each cluster by document
// position, then caps the whole thing to a character budget — dropping
// whole trailing clusters rather than splitting one mid-way. The
// highest-ranked cluster is always included even if it alone exceeds the
// budget, so a turn is never left with no context at all.
export function buildTurnContext(expanded: ExpandedChunk[]): ExpandedChunk[] {
  const clusterOrder: string[] = [];
  const clusters = new Map<string, ExpandedChunk[]>();

  for (const chunk of expanded) {
    if (!clusters.has(chunk.matchedChunkId)) {
      clusters.set(chunk.matchedChunkId, []);
      clusterOrder.push(chunk.matchedChunkId);
    }
    clusters.get(chunk.matchedChunkId)!.push(chunk);
  }

  const result: ExpandedChunk[] = [];
  let usedChars = 0;

  for (const matchedChunkId of clusterOrder) {
    const cluster = [...clusters.get(matchedChunkId)!].sort((a, b) => a.chunkIndex - b.chunkIndex);
    const clusterChars = cluster.reduce((sum, c) => sum + c.content.length, 0);

    if (result.length > 0 && usedChars + clusterChars > CONTEXT_CHAR_BUDGET) {
      break;
    }

    result.push(...cluster);
    usedChars += clusterChars;
  }

  return result;
}
