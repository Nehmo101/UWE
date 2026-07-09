import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeStudioLandingPage, resolveStudioLandingPath } from "./studio-landing";

describe("studio-landing", () => {
  it("defaults unknown values to /today", () => {
    assert.equal(normalizeStudioLandingPage(null), "/today");
    assert.equal(normalizeStudioLandingPage("/invalid"), "/today");
  });

  it("keeps allowed landing paths", () => {
    assert.equal(resolveStudioLandingPath("/capture"), "/capture");
    assert.equal(resolveStudioLandingPath(" /worlds "), "/worlds");
  });
});
