import { describe, expect, it, vi, beforeEach } from "vitest";
import type { KbSearchResult } from "./types.js";

const queryRawMock = vi.fn();
vi.mock("../services/prisma.js", () => ({
  prisma: { $queryRaw: queryRawMock },
}));

const { expandChunks } = await import("./expand.js");

function makeMatch(overrides: Partial<KbSearchResult> = {}): KbSearchResult {
  return {
    chunkId: "match-1",
    content: "matched content",
    sectionPath: "Section",
    summary: null,
    documentId: "doc-1",
    chunkIndex: 5,
    score: 0.9,
    ...overrides,
  };
}

beforeEach(() => {
  queryRawMock.mockReset();
});

describe("expandChunks", () => {
  it("fetches ±1 neighbors scoped to the matched chunk's document", async () => {
    queryRawMock.mockResolvedValueOnce([
      { id: "n-before", content: "before", sectionPath: "Section", chunkIndex: 4 },
      { id: "n-after", content: "after", sectionPath: "Section", chunkIndex: 6 },
    ]);

    const result = await expandChunks([makeMatch()]);

    expect(queryRawMock).toHaveBeenCalledTimes(1);
    // The tag function receives (strings, documentId, indexesArray).
    const callArgs = queryRawMock.mock.calls[0];
    expect(callArgs[1]).toBe("doc-1");
    expect(callArgs[2]).toEqual(expect.arrayContaining([4, 6]));

    expect(result).toHaveLength(3);
    expect(result.find((c) => c.chunkId === "match-1")).toMatchObject({ source: "retrieved" });
    expect(result.find((c) => c.chunkId === "n-before")).toMatchObject({
      source: "expanded",
      matchedChunkId: "match-1",
    });
    expect(result.find((c) => c.chunkId === "n-after")).toMatchObject({
      source: "expanded",
      matchedChunkId: "match-1",
    });
  });

  it("assigns a neighbor shared by two nearby matches to the higher-ranked match only", async () => {
    // match-A at chunkIndex 5 and match-B at chunkIndex 7 both want the
    // chunk at index 6 as a neighbor — it must end up in exactly one cluster.
    queryRawMock.mockResolvedValueOnce([
      { id: "shared", content: "between", sectionPath: null, chunkIndex: 6 },
      { id: "n-4", content: "before A", sectionPath: null, chunkIndex: 4 },
      { id: "n-8", content: "after B", sectionPath: null, chunkIndex: 8 },
    ]);

    const matches = [
      makeMatch({ chunkId: "match-A", chunkIndex: 5, score: 0.9 }),
      makeMatch({ chunkId: "match-B", chunkIndex: 7, score: 0.8 }),
    ];

    const result = await expandChunks(matches);

    const sharedOccurrences = result.filter((c) => c.chunkId === "shared");
    expect(sharedOccurrences).toHaveLength(1);
    expect(sharedOccurrences[0].matchedChunkId).toBe("match-A");
  });

  it("keeps a match with no documentId as its own retrieved chunk, without querying for neighbors", async () => {
    const result = await expandChunks([makeMatch({ documentId: null })]);

    expect(queryRawMock).not.toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({ chunkId: "match-1", source: "retrieved", documentId: "" }),
    ]);
  });
});
