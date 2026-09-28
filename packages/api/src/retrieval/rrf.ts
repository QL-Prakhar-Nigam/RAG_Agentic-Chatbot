export interface RankedResult<T> {
  id: string;
  item: T;
}

export interface FusedResult<T> {
  id: string;
  item: T;
  score: number;
}

const RRF_K = 60;

// Reciprocal Rank Fusion — merges multiple ranked lists using only each
// result's rank position, not its raw score. Cosine similarity and a keyword
// rank live on incompatible scales; RRF sidesteps blending them by rewarding
// agreement between lists instead. See local/planning/02-rag-architecture.md.
export function reciprocalRankFusion<T>(rankedLists: RankedResult<T>[][]): FusedResult<T>[] {
  const scores = new Map<string, number>();
  const items = new Map<string, T>();

  for (const list of rankedLists) {
    list.forEach((result, rank) => {
      const current = scores.get(result.id) ?? 0;
      scores.set(result.id, current + 1 / (RRF_K + rank + 1));
      if (!items.has(result.id)) {
        items.set(result.id, result.item);
      }
    });
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, item: items.get(id) as T, score }))
    .sort((a, b) => b.score - a.score);
}
