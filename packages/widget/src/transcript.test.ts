import { beforeEach, describe, expect, it } from "vitest";
import { appendToTranscript, loadTranscript } from "./transcript.js";

beforeEach(() => {
  sessionStorage.clear();
});

describe("transcript", () => {
  it("returns an empty array when nothing is stored", () => {
    expect(loadTranscript()).toEqual([]);
  });

  it("persists and reloads entries in order", () => {
    appendToTranscript({ role: "user", content: "hi" });
    appendToTranscript({ role: "assistant", content: "hello" });
    expect(loadTranscript()).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("degrades to an empty array on malformed JSON rather than throwing", () => {
    sessionStorage.setItem("rag_chatbot_messages", "{not json");
    expect(loadTranscript()).toEqual([]);
  });

  it("degrades to an empty array when the stored value isn't an array", () => {
    sessionStorage.setItem("rag_chatbot_messages", JSON.stringify({ role: "user", content: "hi" }));
    expect(loadTranscript()).toEqual([]);
  });

  it("filters out entries with an invalid role or non-string content", () => {
    sessionStorage.setItem(
      "rag_chatbot_messages",
      JSON.stringify([
        { role: "user", content: "valid" },
        { role: "system", content: "not a real role" },
        { role: "user", content: 42 },
        { role: "assistant" }, // missing content
        null,
        "just a string",
      ])
    );
    expect(loadTranscript()).toEqual([{ role: "user", content: "valid" }]);
  });
});
