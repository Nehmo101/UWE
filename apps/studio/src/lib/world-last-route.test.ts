import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidWorldLastRoute,
  resolveWorldLastRoute,
  worldWikiPath,
} from "./world-last-route";
import { studioWorldBottomNav } from "./mobile-nav";

describe("world-last-route", () => {
  it("accepts only in-world sub-routes", () => {
    assert.equal(isValidWorldLastRoute("terra", "/worlds/terra/dashboard"), true);
    assert.equal(isValidWorldLastRoute("terra", "/worlds/terra"), false);
    assert.equal(isValidWorldLastRoute("terra", "/worlds/other/dashboard"), false);
  });

  it("rejects the world root for last-route cookies (Phase-D ADR)", () => {
    assert.equal(isValidWorldLastRoute("terra", "/worlds/terra/"), false);
    assert.equal(resolveWorldLastRoute("terra", encodeURIComponent("/worlds/terra")), null);
  });

  it("resolves stored cookie paths safely", () => {
    const encoded = encodeURIComponent("/worlds/terra/sessions");
    assert.equal(resolveWorldLastRoute("terra", encoded), "/worlds/terra/sessions");
    assert.equal(resolveWorldLastRoute("terra", encodeURIComponent("/evil")), null);
  });

  it("exposes the wiki listing path separate from world root", () => {
    assert.equal(worldWikiPath("terra"), "/worlds/terra/wiki");
    assert.notEqual(worldWikiPath("terra"), "/worlds/terra");
  });
});

describe("world routing contract (mobile nav)", () => {
  it("links Inhalte to /wiki not world root", () => {
    const nav = studioWorldBottomNav("terra", "overview");
    const content = nav.find((item) => item.label === "Inhalte");
    assert.ok(content);
    assert.equal(content.href, "/worlds/terra/wiki");
    assert.notEqual(content.href, "/worlds/terra");
  });
});
