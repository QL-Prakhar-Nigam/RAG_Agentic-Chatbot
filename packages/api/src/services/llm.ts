import { DEFAULT_PROVIDER_TIMEOUT_MS, getOpenAIClient } from "./openai-client.js";
import { config } from "../config.js";

export interface ChatMessageInput {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompleteOptions {
  timeoutMs?: number;
  /** Ask the provider to return a raw JSON object instead of free text. */
  jsonMode?: boolean;
}

// The single seam all LLM calls in this repo go through — model choice and
// provider stay contained here (local/planning/01-architecture.md).
export async function chatComplete(
  messages: ChatMessageInput[],
  options: ChatCompleteOptions = {}
): Promise<string> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create(
    {
      model: config.openai.chatModel,
      messages,
      ...(options.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    },
    { timeout: options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS }
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM call returned no content");
  }
  return content;
}
