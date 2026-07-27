import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AVAILABILITY_STATUSES, normalizeAvailabilityStatus } from "./availability";
import { QUEST_PRIORITIES, normalizeQuestPriority } from "./quest-flags";

describe("normalizeQuestPriority", () => {
  it("accepts every known priority, case- and space-insensitively", () => {
    for (const priority of QUEST_PRIORITIES) {
      assert.equal(normalizeQuestPriority(priority), priority);
      assert.equal(normalizeQuestPriority(` ${priority.toUpperCase()} `), priority);
    }
  });

  it("falls back to normal for unknown, empty and missing input", () => {
    assert.equal(normalizeQuestPriority("urgent"), "normal");
    assert.equal(normalizeQuestPriority(""), "normal");
    assert.equal(normalizeQuestPriority(null), "normal");
    assert.equal(normalizeQuestPriority(undefined), "normal");
  });
});

describe("normalizeAvailabilityStatus", () => {
  it("accepts every known status, case- and space-insensitively", () => {
    for (const status of AVAILABILITY_STATUSES) {
      assert.equal(normalizeAvailabilityStatus(status), status);
      assert.equal(normalizeAvailabilityStatus(` ${status.toUpperCase()} `), status);
    }
  });

  it("returns null for unknown, empty and missing input", () => {
    assert.equal(normalizeAvailabilityStatus("perhaps"), null);
    assert.equal(normalizeAvailabilityStatus(""), null);
    assert.equal(normalizeAvailabilityStatus(null), null);
    assert.equal(normalizeAvailabilityStatus(undefined), null);
  });
});
