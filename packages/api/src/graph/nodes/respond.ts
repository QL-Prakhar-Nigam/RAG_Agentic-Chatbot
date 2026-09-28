import { chatComplete, type ChatMessageInput } from "../../services/llm.js";
import type { KbSearchResult } from "../../retrieval/types.js";
import type { GraphStateType } from "../state.js";

// Starting value, not yet tuned — see local/planning/03-langgraph-design.md's
// "Conversation-history window per call".
const HISTORY_WINDOW_MESSAGES = 12;

function buildContext(kbResults: KbSearchResult[]): string {
  if (kbResults.length === 0) {
    return "(no relevant knowledge base content found for this question)";
  }
  return kbResults
    .map((r, i) => `[${i + 1}]${r.sectionPath ? ` ${r.sectionPath}` : ""}\n${r.content}`)
    .join("\n\n");
}

const SYSTEM_PROMPT_PREFIX = [
  "You are a helpful assistant answering questions using only the knowledge base context provided below.",
  "Answer only from that context. If the context doesn't contain enough information to answer, say so",
  "plainly and briefly rather than inventing facts.",
].join(" ");

// Phase 1: no medicalGuard, no navigateCandidates yet — see
// local/planning/06-phased-plan.md. clientActions is always [] until Phase 3.
export async function respondNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const responseMode = state.kbResults.length > 0 ? "answer" : "fallback";
  const trimmedHistory = state.history.slice(-HISTORY_WINDOW_MESSAGES);

  const systemPrompt = `${SYSTEM_PROMPT_PREFIX}\n\nContext:\n${buildContext(state.kbResults)}`;

  const messages: ChatMessageInput[] = [
    { role: "system", content: systemPrompt },
    ...trimmedHistory.map((m) => ({ role: m.role, content: m.content }) as ChatMessageInput),
    { role: "user", content: state.message },
  ];

  const responseText = await chatComplete(messages);

  return {
    responseMode,
    responseText,
    clientActions: [],
    history: [
      { role: "user", content: state.message },
      { role: "assistant", content: responseText },
    ],
  };
}
