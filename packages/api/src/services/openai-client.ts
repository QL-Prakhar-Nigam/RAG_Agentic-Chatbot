import OpenAI from "openai";
import { config } from "../config.js";

// Lazy singleton — constructing the SDK client throws immediately on a
// missing/empty API key, and the server must still boot (health checks, etc.)
// without one configured. Fails at first actual LLM/embedding call instead.
let client: OpenAI | undefined;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: config.openai.apiKey, baseURL: config.openai.baseUrl });
  }
  return client;
}

export const DEFAULT_PROVIDER_TIMEOUT_MS = 30_000;
