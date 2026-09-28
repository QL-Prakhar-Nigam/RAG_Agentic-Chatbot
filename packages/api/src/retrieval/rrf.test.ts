import { describe, expect, it } from "vitest";
import { reciprocalRankFusion } from "./rrf.js";

describe("reciprocalRankFusion", () => {
  it("ranks an item appearing near the top of both lists above one appearing in only one list", () => {
    const vectorList = [
      { id: "a", item: "a" },
      { id: "b", item: "b" },
      { id: "c", item: "c" },
    ];
    const keywordList = [
      { id: "b", item: "b" },
      { id: "a", item: "a" },
    ];

    const fused = reciprocalRankFusion([vectorList, keywordList]);

    // "a" and "b" both appear in both lists near the top; "c" only in one.
    expect(
      fused
        .map((f) => f.id)
        .slice(0, 2)
        .sort()
    ).toEqual(["a", "b"]);
    expect(fused.find((f) => f.id === "c")!.score).toBeLessThan(
      fused.find((f) => f.id === "a")!.score
    );
  });

  it("includes items that only appear in one list", () => {
    const fused = reciprocalRankFusion([[{ id: "x", item: "x" }], []]);
    expect(fused).toHaveLength(1);
    expect(fused[0].id).toBe("x");
  });

  it("returns an empty array when given no results", () => {
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });

  it("de-duplicates an id appearing in multiple lists, keeping the first-seen item", () => {
    const fused = reciprocalRankFusion([
      [{ id: "a", item: "first" }],
      [{ id: "a", item: "second" }],
    ]);
    expect(fused).toHaveLength(1);
    expect(fused[0].item).toBe("first");
  });
});
