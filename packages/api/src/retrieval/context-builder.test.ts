import { describe, expect, it } from "vitest";
import { buildTurnContext, CONTEXT_CHAR_BUDGET } from "./context-builder.js";
import type { ExpandedChunk } from "./types.js";

function chunk(overrides: Partial<ExpandedChunk>): ExpandedChunk {
  return {
    chunkId: "c",
    documentId: "doc-1",
    chunkIndex: 0,
    content: "",
    sectionPath: null,
    source: "retrieved",
    matchedChunkId: "c",
    retrievalScore: 1,
    ...overrides,
  };
}

describe("buildTurnContext", () => {
  it("orders chunks within a cluster by document position, regardless of input order", () => {
    const input: ExpandedChunk[] = [
      chunk({ chunkId: "match", matchedChunkId: "match", chunkIndex: 5, source: "retrieved" }),
      chunk({ chunkId: "after", matchedChunkId: "match", chunkIndex: 6, source: "expanded" }),
      chunk({ chunkId: "before", matchedChunkId: "match", chunkIndex: 4, source: "expanded" }),
    ];

    const result = buildTurnContext(input);

    expect(result.map((c) => c.chunkId)).toEqual(["before", "match", "after"]);
  });

  it("keeps clusters in their original (retrieval-rank) order", () => {
    const input: ExpandedChunk[] = [
      chunk({ chunkId: "second-match", matchedChunkId: "second-match", chunkIndex: 20 }),
      chunk({ chunkId: "first-match", matchedChunkId: "first-match", chunkIndex: 5 }),
    ];

    const result = buildTurnContext(input);

    expect(result.map((c) => c.chunkId)).toEqual(["second-match", "first-match"]);
  });

  it("drops a whole trailing cluster once the budget would be exceeded, never splitting one", () => {
    const bigContent = "x".repeat(CONTEXT_CHAR_BUDGET);
    const input: ExpandedChunk[] = [
      chunk({ chunkId: "first", matchedChunkId: "first", content: bigContent }),
      chunk({ chunkId: "second", matchedChunkId: "second", content: "small" }),
    ];

    const result = buildTurnContext(input);

    expect(result.map((c) => c.chunkId)).toEqual(["first"]);
  });

  it("always includes the top cluster even if it alone exceeds the budget", () => {
    const hugeContent = "x".repeat(CONTEXT_CHAR_BUDGET * 2);
    const input: ExpandedChunk[] = [
      chunk({ chunkId: "only", matchedChunkId: "only", content: hugeContent }),
    ];

    const result = buildTurnContext(input);

    expect(result.map((c) => c.chunkId)).toEqual(["only"]);
  });
});
