export interface RetrievalOutcome {
  question: string;
  correctChunkId: string;
  retrievedIds: string[];
}

export function recallAtK(outcomes: RetrievalOutcome[]): number {
  if (outcomes.length === 0) {
    return 0;
  }
  const hits = outcomes.filter((o) => o.retrievedIds.includes(o.correctChunkId)).length;
  return hits / outcomes.length;
}

export function meanReciprocalRank(outcomes: RetrievalOutcome[]): number {
  if (outcomes.length === 0) {
    return 0;
  }
  const total = outcomes.reduce((sum, o) => {
    const rank = o.retrievedIds.indexOf(o.correctChunkId);
    return sum + (rank === -1 ? 0 : 1 / (rank + 1));
  }, 0);
  return total / outcomes.length;
}
