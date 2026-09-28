import { searchKb, TOP_K } from "../retrieval/kb-search.js";
import { loadGoldenSet } from "./golden-set.js";
import { recallAtK, meanReciprocalRank, type RetrievalOutcome } from "./metrics.js";

export interface EvalReport {
  exampleCount: number;
  topK: number;
  recallAtK: number;
  mrr: number;
}

// Run before/after any change to ingestion or retrieval logic, so changes are
// verified rather than assumed — local/planning/02-rag-architecture.md.
export async function runEval(siteId: string): Promise<EvalReport> {
  const goldenSet = await loadGoldenSet(siteId);
  if (goldenSet.length === 0) {
    return { exampleCount: 0, topK: TOP_K, recallAtK: 0, mrr: 0 };
  }

  const outcomes: RetrievalOutcome[] = [];
  for (const example of goldenSet) {
    const results = await searchKb(siteId, example.question);
    outcomes.push({
      question: example.question,
      correctChunkId: example.chunkId,
      retrievedIds: results.map((r) => r.chunkId),
    });
  }

  return {
    exampleCount: outcomes.length,
    topK: TOP_K,
    recallAtK: recallAtK(outcomes),
    mrr: meanReciprocalRank(outcomes),
  };
}
