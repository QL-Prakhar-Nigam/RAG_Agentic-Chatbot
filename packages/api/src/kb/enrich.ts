import { z } from "zod";
import { chatComplete, type ChatMessageInput } from "../services/llm.js";
import type { ChunkEnrichment, ParsedChunk } from "./types.js";

// 8-12 chunks per call, per local/planning/02-rag-architecture.md.
const BATCH_SIZE = 10;

const enrichmentResponseSchema = z.object({
  items: z.array(
    z.object({
      chunk_id: z.number(),
      summary: z.string(),
      questions: z.array(z.string()),
    })
  ),
});

function buildPrompt(chunks: ParsedChunk[]): ChatMessageInput[] {
  const chunkList = chunks.map((c) => `chunk_id: ${c.chunkIndex}\n${c.text}`).join("\n\n---\n\n");

  return [
    {
      role: "system",
      content:
        "You are helping build a search index for a knowledge base. For each chunk below, " +
        "write a 1-2 sentence summary and 2-4 hypothetical questions a real user might ask that " +
        "this chunk answers. Respond with JSON matching exactly: " +
        '{"items": [{"chunk_id": number, "summary": string, "questions": string[]}]}. ' +
        "Echo back the exact chunk_id given for every chunk you were given — do not renumber, " +
        "skip, or invent chunk_ids.",
    },
    { role: "user", content: chunkList },
  ];
}

// Each chunk is tagged with its id before the call; the model echoes it back
// per item, and results are mapped back by that id, never by array position
// (a model reordering or dropping an item would silently corrupt a
// position-based mapping).
async function enrichBatch(chunks: ParsedChunk[]): Promise<Map<number, ChunkEnrichment>> {
  const result = new Map<number, ChunkEnrichment>();
  let raw: string;
  try {
    raw = await chatComplete(buildPrompt(chunks), { jsonMode: true });
  } catch (err) {
    console.error("enrichment batch call failed", err);
    return result;
  }

  let parsed;
  try {
    parsed = enrichmentResponseSchema.parse(JSON.parse(raw));
  } catch (err) {
    console.error("enrichment batch returned unparseable JSON", err);
    return result;
  }

  for (const item of parsed.items) {
    result.set(item.chunk_id, {
      chunkIndex: item.chunk_id,
      summary: item.summary,
      questions: item.questions,
    });
  }
  return result;
}

export async function enrichChunks(chunks: ParsedChunk[]): Promise<ChunkEnrichment[]> {
  const results = new Map<number, ChunkEnrichment>();

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchResults = await enrichBatch(batch);
    for (const [id, enrichment] of batchResults) {
      results.set(id, enrichment);
    }
  }

  // Missing ids (dropped by the model, or the whole batch call failed) are
  // retried individually rather than failing the whole document.
  const missing = chunks.filter((c) => !results.has(c.chunkIndex));
  for (const chunk of missing) {
    const single = await enrichBatch([chunk]);
    const enrichment = single.get(chunk.chunkIndex);
    if (enrichment) {
      results.set(chunk.chunkIndex, enrichment);
    } else {
      console.warn(`enrichment failed twice for chunk ${chunk.chunkIndex}; leaving it unenriched`);
    }
  }

  return chunks.map(
    (c) => results.get(c.chunkIndex) ?? { chunkIndex: c.chunkIndex, summary: "", questions: [] }
  );
}
