import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isWorldNewSinceLastVisit } from "./world-visit-tracking";

describe("world-visit-tracking", () => {
  it("flags worlds updated after the last visit", () => {
    assert.equal(
      isWorldNewSinceLastVisit("2026-07-09T12:00:00.000Z", "2026-07-08T12:00:00.000Z"),
      true,
    );
    assert.equal(
      isWorldNewSinceLastVisit("2026-07-08T12:00:00.000Z", "2026-07-09T12:00:00.000Z"),
      false,
    );
  });

  it("does not flag first-time visits without a stored timestamp", () => {
    assert.equal(isWorldNewSinceLastVisit("2026-07-09T12:00:00.000Z", undefined), false);
  });
});
