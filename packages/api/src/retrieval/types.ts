export interface KbSearchResult {
  chunkId: string;
  content: string;
  sectionPath: string | null;
  summary: string | null;
  documentId: string | null;
  score: number;
}
