import { describe, expect, it } from "vitest";
import { meanReciprocalRank, recallAtK, type RetrievalOutcome } from "./metrics.js";

describe("recallAtK", () => {
  it("is the fraction of outcomes where the correct chunk was retrieved", () => {
    const outcomes: RetrievalOutcome[] = [
      { question: "q1", correctChunkId: "a", retrievedIds: ["a", "b"] },
      { question: "q2", correctChunkId: "c", retrievedIds: ["x", "y"] },
    ];
    expect(recallAtK(outcomes)).toBe(0.5);
  });

  it("is 0 for an empty outcome set", () => {
    expect(recallAtK([])).toBe(0);
  });
});

describe("meanReciprocalRank", () => {
  it("averages 1/rank across outcomes, scoring a miss as 0", () => {
    const outcomes: RetrievalOutcome[] = [
      { question: "q1", correctChunkId: "a", retrievedIds: ["a", "b"] }, // rank 1 -> 1
      { question: "q2", correctChunkId: "b", retrievedIds: ["a", "b"] }, // rank 2 -> 0.5
      { question: "q3", correctChunkId: "z", retrievedIds: ["a", "b"] }, // miss -> 0
    ];
    expect(meanReciprocalRank(outcomes)).toBeCloseTo((1 + 0.5 + 0) / 3);
  });

  it("is 0 for an empty outcome set", () => {
    expect(meanReciprocalRank([])).toBe(0);
  });
});
