import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWikiLinks } from "./parseWikiLinks";

describe("parseWikiLinks", () => {
  it("parses simple wikilinks", () => {
    const links = parseWikiLinks("Visit [[Waterdeep]] for more.");
    assert.equal(links.length, 1);
    assert.equal(links[0].target, "Waterdeep");
    assert.equal(links[0].label, undefined);
  });

  it("parses wikilinks with custom labels", () => {
    const links = parseWikiLinks("See [[Waterdeep|the city]] for details.");
    assert.equal(links.length, 1);
    assert.equal(links[0].target, "Waterdeep");
    assert.equal(links[0].label, "the city");
  });

  it("parses multiple wikilinks", () => {
    const links = parseWikiLinks("[[Arbor]] und [[Nepurga|die böse Fee]]");
    assert.equal(links.length, 2);
    assert.equal(links[0].target, "Arbor");
    assert.equal(links[1].target, "Nepurga");
    assert.equal(links[1].label, "die böse Fee");
  });

  it("records start and end offsets", () => {
    const text = "Vor [[Validori]] danach.";
    const links = parseWikiLinks(text);
    assert.equal(text.slice(links[0].start, links[0].end), "[[Validori]]");
  });

  it("trims whitespace in targets and labels", () => {
    const links = parseWikiLinks("[[  Nepurga  |  die Fee  ]]");
    assert.equal(links[0].target, "Nepurga");
    assert.equal(links[0].label, "die Fee");
  });
});
