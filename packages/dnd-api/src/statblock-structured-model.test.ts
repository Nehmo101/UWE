import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEmptyStatblockDraft,
  formatAbilityModifier,
  statblockDraftFromData,
  statblockDraftToData,
  validateStatblockDraft,
} from "./statblock-structured-model";

describe("statblock structured model", () => {
  it("parses canonical statblock data into a draft", () => {
    const { draft, extras } = statblockDraftFromData({
      name: "Goblin",
      size: "Small",
      type: "humanoid",
      alignment: "neutral evil",
      ac: 15,
      hp: 7,
      speed: "30 ft.",
      cr: "1/4",
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      skills: "Stealth +6",
      senses: "darkvision 60 ft.",
      traits: [{ name: "Nimble Escape", desc: "Disengage as bonus action." }],
      actions: [{ name: "Scimitar", description: "+4 to hit, 1d6+2 slashing." }],
    });

    assert.equal(draft.name, "Goblin");
    assert.equal(draft.ac, "15");
    assert.equal(draft.hp, "7");
    assert.equal(draft.cr, "1/4");
    assert.equal(draft.abilities.dex, 14);
    assert.equal(draft.skills, "Stealth +6");
    assert.equal(draft.traits[0]?.name, "Nimble Escape");
    assert.equal(draft.actions[0]?.desc, "+4 to hit, 1d6+2 slashing.");
    assert.deepEqual(extras, {});
  });

  it("normalizes Open5e-style aliases and preserves unknown fields", () => {
    const { draft, extras } = statblockDraftFromData({
      name: "Wolf",
      armor_class: 13,
      hit_points: 11,
      hit_dice: "2d8+2",
      challenge_rating: "1/4",
      strength: 12,
      dexterity: 15,
      constitution: 12,
      intelligence: 3,
      wisdom: 12,
      charisma: 6,
      dexterity_save: 4,
      speed: { walk: 40, swim: 20 },
      skills: { perception: 3, stealth: 4 },
      special_abilities: [{ name: "Keen Hearing", desc: "Advantage on hearing." }],
      legendary_actions: [{ name: "Move", desc: "Moves half speed." }],
      img_main: "https://example.invalid/wolf.png",
      document__slug: "wotc-srd",
    });

    assert.equal(draft.ac, "13");
    assert.equal(draft.hp, "11");
    assert.equal(draft.hitDice, "2d8+2");
    assert.equal(draft.cr, "1/4");
    assert.equal(draft.abilities.str, 12);
    assert.equal(draft.abilities.dex, 15);
    assert.equal(draft.speed, "walk 40 ft., swim 20 ft.");
    assert.equal(draft.saves, "Dex +4");
    assert.equal(draft.skills, "Perception +3, Stealth +4");
    assert.equal(draft.traits[0]?.name, "Keen Hearing");
    assert.equal(draft.legendaryActions[0]?.name, "Move");
    assert.deepEqual(extras, {
      img_main: "https://example.invalid/wolf.png",
      document__slug: "wotc-srd",
    });
  });

  it("serializes a draft back to canonical data and keeps extras", () => {
    const draft = createEmptyStatblockDraft();
    draft.name = "Ogre";
    draft.ac = "11";
    draft.hp = "59 (7d10+21)";
    draft.abilities.str = 19;
    draft.actions = [
      { name: "Greatclub", desc: "+6 to hit, 2d8+4 bludgeoning." },
      { name: "", desc: "" },
    ];

    const data = statblockDraftToData(draft, { source_note: "homebrew" });

    assert.equal(data.name, "Ogre");
    assert.equal(data.ac, 11);
    assert.equal(data.hp, "59 (7d10+21)");
    assert.deepEqual(data.abilities, { str: 19, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
    assert.deepEqual(data.actions, [{ name: "Greatclub", desc: "+6 to hit, 2d8+4 bludgeoning." }]);
    assert.equal("traits" in data, false);
    assert.equal("size" in data, false);
    assert.equal(data.source_note, "homebrew");
  });

  it("round-trips draft data through parse and serialize", () => {
    const original = statblockDraftFromData({
      name: "Bandit",
      size: "Medium",
      ac: 12,
      hp: 11,
      abilities: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
      actions: [{ name: "Scimitar", desc: "+3 to hit." }],
    });

    const reparsed = statblockDraftFromData(
      statblockDraftToData(original.draft, original.extras),
    );

    assert.deepEqual(reparsed.draft, original.draft);
    assert.deepEqual(reparsed.extras, original.extras);
  });

  it("formats ability modifiers", () => {
    assert.equal(formatAbilityModifier(8), "-1");
    assert.equal(formatAbilityModifier(10), "+0");
    assert.equal(formatAbilityModifier(19), "+4");
  });

  it("validates required name and ability score range", () => {
    const draft = createEmptyStatblockDraft();
    draft.abilities.str = -3;

    const errors = validateStatblockDraft(draft);

    assert.equal(errors.length, 2);
    assert.match(errors[0] ?? "", /Name/);
    assert.match(errors[1] ?? "", /STR/);

    draft.name = "Test";
    draft.abilities.str = 18;
    assert.deepEqual(validateStatblockDraft(draft), []);
  });
});
