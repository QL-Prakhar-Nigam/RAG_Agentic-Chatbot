import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ParsedChunk } from "./types.js";

const chatCompleteMock = vi.fn();
vi.mock("../services/llm.js", () => ({
  chatComplete: chatCompleteMock,
}));

const { enrichChunks } = await import("./enrich.js");

function makeChunk(chunkIndex: number, text = `text ${chunkIndex}`): ParsedChunk {
  return { chunkIndex, text, sectionPath: null, contextualized: text };
}

beforeEach(() => {
  chatCompleteMock.mockReset();
});

describe("enrichChunks", () => {
  it("maps enrichment results back by chunk_id, not array position", async () => {
    chatCompleteMock.mockResolvedValueOnce(
      JSON.stringify({
        items: [
          // deliberately out of order vs. the input chunks
          { chunk_id: 1, summary: "s1", questions: ["q1"] },
          { chunk_id: 0, summary: "s0", questions: ["q0"] },
        ],
      })
    );

    const result = await enrichChunks([makeChunk(0), makeChunk(1)]);

    expect(result.find((r) => r.chunkIndex === 0)).toMatchObject({ summary: "s0" });
    expect(result.find((r) => r.chunkIndex === 1)).toMatchObject({ summary: "s1" });
    expect(chatCompleteMock).toHaveBeenCalledTimes(1);
  });

  it("retries a chunk missing from the batch response individually", async () => {
    chatCompleteMock
      .mockResolvedValueOnce(
        // batch call only returns chunk 0, chunk 1 is missing
        JSON.stringify({ items: [{ chunk_id: 0, summary: "s0", questions: [] }] })
      )
      .mockResolvedValueOnce(
        // individual retry for chunk 1 succeeds
        JSON.stringify({ items: [{ chunk_id: 1, summary: "s1-retry", questions: [] }] })
      );

    const result = await enrichChunks([makeChunk(0), makeChunk(1)]);

    expect(chatCompleteMock).toHaveBeenCalledTimes(2);
    expect(result.find((r) => r.chunkIndex === 1)).toMatchObject({ summary: "s1-retry" });
  });

  it("falls back to an empty enrichment when a chunk fails both the batch and the retry", async () => {
    chatCompleteMock
      .mockResolvedValueOnce(JSON.stringify({ items: [] })) // batch drops the only chunk
      .mockResolvedValueOnce(JSON.stringify({ items: [] })); // retry also drops it

    const result = await enrichChunks([makeChunk(0)]);

    expect(result).toEqual([{ chunkIndex: 0, summary: "", questions: [] }]);
  });

  it("treats unparseable JSON as a fully missing batch and retries every chunk individually", async () => {
    chatCompleteMock
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce(
        JSON.stringify({ items: [{ chunk_id: 0, summary: "s0", questions: [] }] })
      );

    const result = await enrichChunks([makeChunk(0)]);

    expect(chatCompleteMock).toHaveBeenCalledTimes(2);
    expect(result[0]).toMatchObject({ summary: "s0" });
  });

  it("batches at 10 chunks per call", async () => {
    chatCompleteMock.mockImplementation(async (messages: { content: string }[]) => {
      const userMessage = messages[1].content;
      const ids = [...userMessage.matchAll(/chunk_id: (\d+)/g)].map((m) => Number(m[1]));
      return JSON.stringify({
        items: ids.map((id) => ({ chunk_id: id, summary: `s${id}`, questions: [] })),
      });
    });

    const chunks = Array.from({ length: 12 }, (_, i) => makeChunk(i));
    const result = await enrichChunks(chunks);

    expect(chatCompleteMock).toHaveBeenCalledTimes(2); // 10 + 2
    expect(result).toHaveLength(12);
    expect(result.every((r) => r.summary === `s${r.chunkIndex}`)).toBe(true);
  });
});
