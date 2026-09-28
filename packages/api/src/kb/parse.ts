import { fileURLToPath } from "node:url";
import path from "node:path";
import { chunkFileAsync } from "docling.rs";
import type { ParsedChunk } from "./types.js";

// Resolved from this module's own location, not process.cwd() — the hybrid
// chunker's tokenizer must be found regardless of where the process is
// started from (see local/planning/05-setup.md's env-var-discipline spirit:
// don't make correctness depend on an incidental cwd).
const TOKENIZER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../models/chunk-tokenizer.json"
);

const MAX_CHUNK_TOKENS = 256;
const HEADING_SEPARATOR = " › "; // › — matches sectionPath's display use in KbChunk

// Parses a document and runs docling.rs's hybrid chunker over it — see
// local/planning/02-rag-architecture.md on why the hybrid chunker is used
// as-is rather than hand-rolled.
export async function parseAndChunk(filePath: string): Promise<ParsedChunk[]> {
  const chunks = await chunkFileAsync(filePath, {
    chunker: "hybrid",
    tokenizer: TOKENIZER_PATH,
    maxTokens: MAX_CHUNK_TOKENS,
  });

  return chunks.map((chunk, chunkIndex) => ({
    chunkIndex,
    text: chunk.text,
    sectionPath:
      chunk.headings && chunk.headings.length > 0 ? chunk.headings.join(HEADING_SEPARATOR) : null,
    contextualized: chunk.contextualized,
  }));
}
