import type { ChatRequest, ChatResponse } from "@rag-chatbot/shared";

interface SendChatMessageInput {
  apiBase: string;
  siteId: string;
  sessionId: string;
  message: string;
}

// The one place this package talks to the network. See
// local/planning/07-api-contracts.md for the request/response shape.
export async function sendChatMessage(input: SendChatMessageInput): Promise<ChatResponse> {
  const body: ChatRequest = {
    message: input.message,
    siteId: input.siteId,
    sessionId: input.sessionId,
  };

  const res = await fetch(`${input.apiBase}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Matches middleware/error-handler.ts's structured error shape.
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error?.message ?? `Request failed (${res.status})`);
  }

  return res.json();
}
