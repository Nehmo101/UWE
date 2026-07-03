import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildHandoutInbox, isNewUnlock } from "./handout-inbox";

const NOW = new Date("2026-07-03T12:00:00Z");

describe("handout inbox", () => {
  it("marks unlocks within the window as new", () => {
    assert.equal(isNewUnlock(new Date("2026-07-01T12:00:00Z"), NOW), true);
    assert.equal(isNewUnlock(new Date("2026-06-01T12:00:00Z"), NOW), false);
  });

  it("sorts new handouts first, then by unlock recency", () => {
    const inbox = buildHandoutInbox(
      [{ id: "old" }, { id: "fresh" }, { id: "never-unlocked" }, { id: "fresher" }],
      [
        { pageId: "old", unlockedAt: new Date("2026-01-01T00:00:00Z"), sessionLabel: "Session 3" },
        { pageId: "fresh", unlockedAt: new Date("2026-07-01T00:00:00Z"), sessionLabel: "Session 11" },
        { pageId: "fresher", unlockedAt: new Date("2026-07-02T00:00:00Z"), sessionLabel: null },
      ],
      NOW,
    );

    assert.deepEqual(
      inbox.map((item) => item.page.id),
      ["fresher", "fresh", "old", "never-unlocked"],
    );
    assert.equal(inbox[0]!.isNew, true);
    assert.equal(inbox[1]!.sessionLabel, "Session 11");
    assert.equal(inbox[2]!.isNew, false);
    assert.equal(inbox[3]!.unlockedAt, null);
  });
});
