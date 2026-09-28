import { describe, expect, it, vi } from "vitest";

const chunkFileAsyncMock = vi.fn();
vi.mock("docling.rs", () => ({
  chunkFileAsync: chunkFileAsyncMock,
}));

const { parseAndChunk } = await import("./parse.js");

describe("parseAndChunk", () => {
  it("wraps docling's raw Chunk shape into our own ParsedChunk, joining headings into sectionPath", async () => {
    chunkFileAsyncMock.mockResolvedValue([
      {
        text: "chunk one",
        headings: ["Cardiology", "Services"],
        docItems: ["#/texts/1"],
        contextualized: "Cardiology\nServices\nchunk one",
      },
      {
        text: "chunk two",
        headings: undefined,
        docItems: ["#/texts/2"],
        contextualized: "chunk two",
      },
    ]);

    const result = await parseAndChunk("/tmp/doc.md");

    expect(result).toEqual([
      {
        chunkIndex: 0,
        text: "chunk one",
        sectionPath: "Cardiology › Services",
        contextualized: "Cardiology\nServices\nchunk one",
      },
      {
        chunkIndex: 1,
        text: "chunk two",
        sectionPath: null,
        contextualized: "chunk two",
      },
    ]);
  });

  it("calls docling's hybrid chunker with a tokenizer path", async () => {
    chunkFileAsyncMock.mockResolvedValue([]);
    await parseAndChunk("/tmp/doc.md");

    expect(chunkFileAsyncMock).toHaveBeenCalledWith(
      "/tmp/doc.md",
      expect.objectContaining({
        chunker: "hybrid",
        tokenizer: expect.stringContaining("chunk-tokenizer.json"),
      })
    );
  });
});
