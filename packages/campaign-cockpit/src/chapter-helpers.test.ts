import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chapterProgress, compareChapterOrder, findCurrentChapter } from "./chapter-helpers";

describe("compareChapterOrder (pure)", () => {
  it("orders imported chapters by sortIndex, manual ones after by title", () => {
    const chapters = [
      { sortIndex: null, title: "Zeta-Anhang" },
      { sortIndex: 2, title: "Kapitel Zwei" },
      { sortIndex: null, title: "Anhang" },
      { sortIndex: 1, title: "Kapitel Eins" },
    ];
    const ordered = [...chapters].sort(compareChapterOrder).map((chapter) => chapter.title);
    assert.deepEqual(ordered, ["Kapitel Eins", "Kapitel Zwei", "Anhang", "Zeta-Anhang"]);
  });
});

describe("chapterProgress (pure)", () => {
  it("counts played and skipped chapters as done", () => {
    const progress = chapterProgress([
      { prepStatus: "played" },
      { prepStatus: "skipped" },
      { prepStatus: "ready" },
      { prepStatus: null },
    ]);
    assert.equal(progress.played, 2);
    assert.equal(progress.total, 4);
    assert.equal(progress.label, "2 von 4 Kapiteln gespielt");
  });

  it("stays quiet without chapters", () => {
    assert.equal(chapterProgress([]).label, "");
  });
});

describe("findCurrentChapter (pure)", () => {
  it("returns the first unplayed chapter in reading order", () => {
    const current = findCurrentChapter([
      { sortIndex: 2, title: "Zwei", prepStatus: "ready" },
      { sortIndex: 1, title: "Eins", prepStatus: "played" },
      { sortIndex: 3, title: "Drei", prepStatus: null },
    ]);
    assert.equal(current?.title, "Zwei");
  });

  it("returns null when everything is played", () => {
    assert.equal(
      findCurrentChapter([{ sortIndex: 1, title: "Eins", prepStatus: "played" }]),
      null,
    );
  });
});
