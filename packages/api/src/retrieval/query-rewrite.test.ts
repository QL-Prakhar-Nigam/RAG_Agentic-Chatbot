import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ChatMessage } from "@rag-chatbot/shared";

const chatCompleteMock = vi.fn();
vi.mock("../services/llm.js", () => ({
  chatComplete: chatCompleteMock,
}));
vi.mock("../config.js", () => ({
  config: { openai: { rewriteModel: "test-rewrite-model" } },
}));

const { maybeRewriteQuery } = await import("./query-rewrite.js");

beforeEach(() => {
  chatCompleteMock.mockReset();
});

describe("maybeRewriteQuery", () => {
  it("skips the LLM call entirely on the first turn of a session (no history)", async () => {
    const result = await maybeRewriteQuery("What about international refunds?", []);

    expect(chatCompleteMock).not.toHaveBeenCalled();
    expect(result).toBe("What about international refunds?");
  });

  it("calls the rewrite model (not the default chat model) whenever history exists", async () => {
    chatCompleteMock.mockResolvedValueOnce("What are the international refund rules?");
    const history: ChatMessage[] = [{ role: "user", content: "What is the refund policy?" }];

    await maybeRewriteQuery("What about international ones?", history);

    expect(chatCompleteMock).toHaveBeenCalledTimes(1);
    expect(chatCompleteMock.mock.calls[0][1]).toEqual({ model: "test-rewrite-model" });
  });

  it("rewrites a follow-up and returns the trimmed output, even for a longer message", async () => {
    chatCompleteMock.mockResolvedValueOnce("  What are the international refund rules?  ");
    const history: ChatMessage[] = [
      { role: "user", content: "What is the refund policy?" },
      { role: "assistant", content: "Refunds are available within 30 days." },
    ];

    const result = await maybeRewriteQuery(
      "But does that also apply to purchases made from outside the country?",
      history
    );

    expect(result).toBe("What are the international refund rules?");
  });

  it("passes through a message the model judges already standalone", async () => {
    chatCompleteMock.mockResolvedValueOnce("What is the cancellation policy for annual plans?");
    const history: ChatMessage[] = [{ role: "user", content: "unrelated earlier question" }];

    const result = await maybeRewriteQuery(
      "What is the cancellation policy for annual plans?",
      history
    );

    expect(result).toBe("What is the cancellation policy for annual plans?");
  });

  it("falls back to the original message when the rewrite call fails", async () => {
    chatCompleteMock.mockRejectedValueOnce(new Error("timeout"));
    const history: ChatMessage[] = [{ role: "user", content: "earlier question" }];

    const result = await maybeRewriteQuery("what about that?", history);

    expect(result).toBe("what about that?");
  });
});
