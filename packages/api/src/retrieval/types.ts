export interface KbSearchResult {
  chunkId: string;
  content: string;
  sectionPath: string | null;
  summary: string | null;
  documentId: string | null;
  chunkIndex: number;
  score: number;
}

// A chunk on its way to `respond`'s context, after small-to-big expansion —
// see local/planning/02-rag-architecture.md. "retrieved" chunks actually
// matched the query (they carry a real retrievalScore and get a citation
// number); "expanded" chunks are a retrieved chunk's document neighbors,
// included for surrounding context only — never an independent search hit.
export interface ExpandedChunk {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  sectionPath: string | null;
  source: "retrieved" | "expanded";
  // The chunkId of the "retrieved" chunk this one belongs to — equal to its
  // own chunkId when source is "retrieved". Used to group and order chunks
  // into per-match clusters rather than flattening everything into one
  // cross-document ordering.
  matchedChunkId: string;
  retrievalScore: number | null;
}
