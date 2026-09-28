import type { ChatResponse } from "@rag-chatbot/shared";
import { getGraph } from "./graph.js";

export interface RunTurnInput {
  siteId: string;
  sessionId: string;
  message: string;
}

// The one function /chat and /chat/stream (Phase 4) both call — only the
// transport differs. See local/planning/05-setup.md's "One turn function,
// two transports".
export async function runTurn(input: RunTurnInput): Promise<ChatResponse> {
  const graph = await getGraph();
  const result = await graph.invoke(
    { siteId: input.siteId, sessionId: input.sessionId, message: input.message },
    { configurable: { thread_id: input.sessionId } }
  );

  return {
    responseText: result.responseText,
    clientActions: result.clientActions,
    sessionId: input.sessionId,
  };
}
