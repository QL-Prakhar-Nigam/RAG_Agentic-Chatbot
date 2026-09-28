// Our own shape, deliberately not re-exporting docling.rs's raw Chunk type —
// see local/planning/02-rag-architecture.md on why the parser is wrapped
// (contained blast radius if docling.rs's output format changes, or if it's
// ever swapped for a Python-backed service).
export interface ParsedChunk {
  chunkIndex: number;
  text: string;
  sectionPath: string | null;
  /** docling's context-enriched string (heading path + text) — what gets embedded. */
  contextualized: string;
}

export interface ChunkEnrichment {
  chunkIndex: number;
  summary: string;
  questions: string[];
}
