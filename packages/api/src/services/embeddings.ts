import { DEFAULT_PROVIDER_TIMEOUT_MS, getOpenAIClient } from "./openai-client.js";
import { config } from "../config.js";

// Same provider-abstraction reasoning as llm.ts — the single seam embedding
// calls go through (local/planning/01-architecture.md).
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }
  const client = getOpenAIClient();
  const response = await client.embeddings.create(
    { model: config.openai.embeddingModel, input: texts },
    { timeout: DEFAULT_PROVIDER_TIMEOUT_MS }
  );
  // The API returns results in input order, but sort by `index` defensively
  // rather than trusting that invariant to hold forever.
  return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}
