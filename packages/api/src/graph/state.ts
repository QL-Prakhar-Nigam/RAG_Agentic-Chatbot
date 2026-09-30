import { Annotation } from "@langchain/langgraph";
import type { ChatMessage, ClientAction } from "@rag-chatbot/shared";
import type { ExpandedChunk, KbSearchResult } from "../retrieval/types.js";

// Phase 1 subset of the full GraphState in local/planning/03-langgraph-design.md
// — medicalRedirect/routeCandidates/ctaCandidates are added in Phase 2/3, not
// speculatively stubbed in now.
function overwrite<T>(_left: T, right: T): T {
  return right;
}

export const GraphAnnotation = Annotation.Root({
  siteId: Annotation<string>,
  sessionId: Annotation<string>,
  message: Annotation<string>,

  // Accumulates across turns via the checkpointer (keyed by sessionId as
  // thread_id) — trimmed to a fixed window before `respond` reads it.
  history: Annotation<ChatMessage[]>({
    reducer: (left: ChatMessage[], right: ChatMessage[]) => left.concat(right),
    default: () => [],
  }),

  kbResults: Annotation<KbSearchResult[]>({ reducer: overwrite, default: () => [] }),

  // kbResults after small-to-big expansion + the context budget — what
  // respond actually renders into the prompt. Kept separate from kbResults
  // so responseMode still decides purely from whether anything matched, not
  // from the (possibly larger) expanded set. See
  // local/planning/02-rag-architecture.md.
  contextChunks: Annotation<ExpandedChunk[]>({ reducer: overwrite, default: () => [] }),

  responseMode: Annotation<"answer" | "fallback" | undefined>({
    reducer: overwrite,
    default: () => undefined,
  }),

  responseText: Annotation<string>({ reducer: overwrite, default: () => "" }),
  clientActions: Annotation<ClientAction[]>({ reducer: overwrite, default: () => [] }),
});

export type GraphStateType = typeof GraphAnnotation.State;
