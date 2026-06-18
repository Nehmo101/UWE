import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildResearchReport } from "./index";

describe("web-search", () => {
  it("builds markdown report from results", () => {
    const report = buildResearchReport("dragon lore", [
      { url: "https://example.com", title: "Example", snippet: "A dragon tale." },
    ]);
    assert.match(report, /# Research: dragon lore/);
    assert.match(report, /\[Example\]\(https:\/\/example.com\)/);
  });
});
