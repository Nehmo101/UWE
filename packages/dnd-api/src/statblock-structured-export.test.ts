import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  exportStructuredStatblockHomebrewery,
  exportStructuredStatblockJson,
} from "./statblock-structured-export";

describe("statblock structured export", () => {
  it("exports homebrewery statblock", () => {
    const markdown = exportStructuredStatblockHomebrewery({
      name: "Goblin",
      size: "Small",
      type: "humanoid",
      cr: "1/4",
      ac: 15,
      hp: 7,
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    });

    assert.match(markdown, /Goblin/);
    assert.match(markdown, /Herausforderungsgrad/);
  });

  it("exports raw json", () => {
    const json = exportStructuredStatblockJson({ name: "Test" });
    assert.match(json, /"name": "Test"/);
  });
});
