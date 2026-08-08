import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSpeciesJson } from "./character-json";
import { validateFullDraft } from "./character-draft-validation";
import { findSpecies } from "@uwe/character-creator";

describe("validateFullDraft sizeKey", () => {
  it("rejects mensch without sizeKey", () => {
    const result = validateFullDraft({
      name: "Test",
      speciesKey: "mensch",
      lineageKey: null,
      classKey: "kaempfer",
      subclassKey: null,
      backgroundKey: "akolyth",
      customBackground: null,
      abilities: null,
      chosenSkills: [],
      equipmentChoice: null,
      cantrips: [],
      spells: [],
      languages: [],
      alignmentKey: null,
      details: {
        pronouns: "",
        age: "",
        height: "",
        weight: "",
        eyes: "",
        hair: "",
        skin: "",
        appearance: "",
        backstory: "",
        personality: "",
        ideals: "",
        bonds: "",
        flaws: "",
      },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.includes("Größe")));
  });

  it("buildSpeciesJson uses sizeKey over default medium", () => {
    const species = findSpecies("mensch");
    assert.ok(species);
    const json = buildSpeciesJson(species, null, "small");
    assert.equal(json.size, "small");
  });
});

describe("validateFullDraft inventionKey", () => {
  it("rejects erfinder without inventionKey", () => {
    const result = validateFullDraft({
      name: "Tinker",
      speciesKey: "zwerg",
      lineageKey: null,
      sizeKey: null,
      classKey: "erfinder",
      subclassKey: "alchimist",
      backgroundKey: "akolyth",
      customBackground: null,
      abilities: null,
      chosenSkills: [],
      equipmentChoice: null,
      cantrips: [],
      spells: [],
      languages: [],
      alignmentKey: null,
      details: {
        pronouns: "",
        age: "",
        height: "",
        weight: "",
        eyes: "",
        hair: "",
        skin: "",
        appearance: "",
        backstory: "",
        personality: "",
        ideals: "",
        bonds: "",
        flaws: "",
      },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.toLowerCase().includes("invention")));
  });
});
