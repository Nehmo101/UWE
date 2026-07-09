import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidWorldLastRoute,
  resolveWorldLastRoute,
  worldWikiPath,
} from "./world-last-route";

describe("world-last-route", () => {
  it("accepts only in-world sub-routes", () => {
    assert.equal(isValidWorldLastRoute("terra", "/worlds/terra/dashboard"), true);
    assert.equal(isValidWorldLastRoute("terra", "/worlds/terra"), false);
    assert.equal(isValidWorldLastRoute("terra", "/worlds/other/dashboard"), false);
  });

  it("resolves stored cookie paths safely", () => {
    const encoded = encodeURIComponent("/worlds/terra/sessions");
    assert.equal(resolveWorldLastRoute("terra", encoded), "/worlds/terra/sessions");
    assert.equal(resolveWorldLastRoute("terra", encodeURIComponent("/evil")), null);
  });

  it("exposes the wiki listing path", () => {
    assert.equal(worldWikiPath("terra"), "/worlds/terra/wiki");
  });
});
