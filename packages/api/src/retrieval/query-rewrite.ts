import type { ChatMessage } from "@rag-chatbot/shared";
import { chatComplete } from "../services/llm.js";
import { config } from "../config.js";

// How much recent history the rewrite call sees — a small window is enough
// to resolve a follow-up's missing antecedent, unlike respond's much larger
// HISTORY_WINDOW_MESSAGES.
export const REWRITE_HISTORY_WINDOW = 4;

// Rewrites an elliptical follow-up into a standalone search query, for
// retrieval only — the original message is what respond answers from and
// what gets appended to history, never this rewritten one.
//
// Runs on every turn after the first (nothing to resolve against on turn
// one). An earlier version tried to pre-filter which turns need rewriting
// with a hand-written heuristic (short message / a fixed list of "what
// about"-style openers) — dropped because it missed ordinary long-form
// follow-ups ("But does this also apply to my kids as well?") that don't
// happen to match the list. Cheaper to let the model decide in the same
// call: the prompt asks it to return the message unchanged when it's
// already standalone, so a wrong guess costs nothing beyond running the
// call itself.
//
// Uses config.openai.rewriteModel, not chatModel — this is a narrow,
// single-purpose call, and worth pointing at a smaller/faster/cheaper model
// independently of the model that writes the actual answer. Set
// OPENAI_REWRITE_MODEL to change it; unset, it defaults to chatModel (no
// behavior change).
export async function maybeRewriteQuery(message: string, history: ChatMessage[]): Promise<string> {
  if (history.length === 0) {
    return message;
  }

  const recentHistory = history.slice(-REWRITE_HISTORY_WINDOW);

  try {
    const raw = await chatComplete(
      [
        {
          role: "system",
          content:
            "Rewrite the user's latest message into a standalone search query, using the " +
            "conversation history to resolve anything it depends on (pronouns, implied subject). " +
            "If the message is already a standalone question, return it unchanged. " +
            "Output only the query and nothing else.",
        },
        ...recentHistory.map((m) => ({ role: m.role, content: m.content }) as const),
        { role: "user", content: message },
      ],
      { model: config.openai.rewriteModel }
    );
    const rewritten = raw.trim();
    return rewritten.length > 0 ? rewritten : message;
  } catch (err) {
    // A broken rewrite call falls back to the original message rather than
    // failing the turn — mirrors kb/enrich.ts's batch-call resilience.
    console.error("query rewrite failed, falling back to the original message", err);
    return message;
  }
}
