import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeStudioLandingPage, resolveStudioLandingPath } from "./studio-landing";

describe("studio-landing", () => {
  it("defaults unknown values to /worlds", () => {
    assert.equal(normalizeStudioLandingPage(null), "/worlds");
    assert.equal(normalizeStudioLandingPage("/invalid"), "/worlds");
  });

  it("keeps allowed landing paths", () => {
    assert.equal(resolveStudioLandingPath("/continue"), "/continue");
    assert.equal(resolveStudioLandingPath(" /worlds "), "/worlds");
  });
});
