import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWikiLinks } from "@uwe/wiki-engine";

describe("parseWikiLinks", () => {
  it("parses simple wikilinks", () => {
    const links = parseWikiLinks("Visit [[Waterdeep]] for more.");
    assert.equal(links.length, 1);
    assert.equal(links[0].target, "Waterdeep");
  });

  it("parses wikilinks with custom labels", () => {
    const links = parseWikiLinks("See [[Waterdeep|the city]] for details.");
    assert.equal(links.length, 1);
    assert.equal(links[0].target, "Waterdeep");
    assert.equal(links[0].label, "the city");
  });
});
