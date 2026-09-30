import { chatComplete, type ChatMessageInput } from "../../services/llm.js";
import type { ExpandedChunk } from "../../retrieval/types.js";
import type { GraphStateType } from "../state.js";

// Starting value, not yet tuned — see local/planning/03-langgraph-design.md's
// "Conversation-history window per call".
const HISTORY_WINDOW_MESSAGES = 12;

// contextChunks is already grouped into per-match clusters and ordered by
// retrieval rank (see retrieval/context-builder.ts) — this only renders it.
// A citation number is assigned per cluster, not per chunk, so an expanded
// neighbor never reads as an independent source; its text is folded into its
// match's numbered block instead.
function buildContext(contextChunks: ExpandedChunk[]): string {
  if (contextChunks.length === 0) {
    return "(no relevant knowledge base content found for this question)";
  }

  const clusterOrder: string[] = [];
  const clusters = new Map<string, ExpandedChunk[]>();
  for (const chunk of contextChunks) {
    if (!clusters.has(chunk.matchedChunkId)) {
      clusters.set(chunk.matchedChunkId, []);
      clusterOrder.push(chunk.matchedChunkId);
    }
    clusters.get(chunk.matchedChunkId)!.push(chunk);
  }

  return clusterOrder
    .map((matchedChunkId, i) => {
      const cluster = clusters.get(matchedChunkId)!;
      const matched = cluster.find((c) => c.source === "retrieved") ?? cluster[0];
      const body = cluster.map((c) => c.content).join("\n");
      return `[${i + 1}]${matched.sectionPath ? ` ${matched.sectionPath}` : ""}\n${body}`;
    })
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
  // responseMode is decided from the raw matches, not the (possibly larger)
  // expanded context — expansion changes what the model reads, not whether
  // anything was actually found.
  const responseMode = state.kbResults.length > 0 ? "answer" : "fallback";
  const trimmedHistory = state.history.slice(-HISTORY_WINDOW_MESSAGES);

  const systemPrompt = `${SYSTEM_PROMPT_PREFIX}\n\nContext:\n${buildContext(state.contextChunks)}`;

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
