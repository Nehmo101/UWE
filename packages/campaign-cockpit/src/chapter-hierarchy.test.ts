import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChapterTree,
  descendantChapterIds,
  rollupChapterQuestCounts,
  rootChapters,
} from "./chapter-hierarchy";

const chapters = [
  { id: "act-2", parentChapterId: null, sortIndex: 2, title: "Akt II" },
  { id: "chapter-1", parentChapterId: "act-1", sortIndex: 1, title: "Kapitel 1" },
  { id: "pool", parentChapterId: "act-1", sortIndex: 9, title: "Nebenquests" },
  { id: "act-1", parentChapterId: null, sortIndex: 1, title: "Akt I" },
];

describe("campaign chapter hierarchy", () => {
  it("separates acts from their chapters and keeps reading order", () => {
    assert.deepEqual(rootChapters(chapters).map((chapter) => chapter.id), ["act-1", "act-2"]);
    assert.deepEqual(buildChapterTree(chapters)[0]?.children.map((node) => node.chapter.id), [
      "chapter-1",
      "pool",
    ]);
  });

  it("collects an act and all descendants without looping", () => {
    assert.deepEqual(descendantChapterIds(chapters, "act-1"), ["act-1", "chapter-1", "pool"]);
  });

  it("rolls quest pools up into the containing act", () => {
    const rolled = rollupChapterQuestCounts(
      chapters,
      new Map([["pool", { open: 7, completed: 1, failed: 0, total: 8 }]]),
    );
    assert.deepEqual(rolled.get("act-1"), { open: 7, completed: 1, failed: 0, total: 8 });
    assert.deepEqual(rolled.get("act-2"), { open: 0, completed: 0, failed: 0, total: 0 });
  });
});
