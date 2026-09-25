import type { ClientAction } from "./client-action.js";

// See local/planning/07-api-contracts.md — describes both POST /chat (Phase 1)
// and POST /chat/stream (Phase 4); streaming delivers the same final shape
// incrementally.
export interface ChatRequest {
  message: string;
  siteId: string;
  sessionId: string;
}

export interface ChatResponse {
  responseText: string;
  clientActions: ClientAction[]; // [] when there's nothing to offer — always present, never omitted
  sessionId: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
