import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCharacterSheetSnapshot,
  computeCharacterDerivedStats,
  extractCharacterProficiencyFormInput,
  inferSpellcastingAbility,
  parseCharacterSkillProfile,
  parseSpellcastingConfig,
  passiveScore,
  savingThrowModifier,
  skillModifier,
  spellAttackBonus,
  spellSaveDc,
  type AbilityScores,
} from "./character-service";
import { computeSpellSlots } from "./character-spell-service";

const WIZARD_5_ABILITIES: AbilityScores = {
  strength: 8,
  dexterity: 14,
  constitution: 14,
  intelligence: 16,
  wisdom: 12,
  charisma: 10,
};

describe("character derived stats (2024 rules)", () => {
  it("computes saving throw and skill modifiers with proficiency and expertise", () => {
    // Level 5 → proficiency bonus +3
    assert.equal(savingThrowModifier(3, true, 3), 6);
    assert.equal(savingThrowModifier(3, false, 3), 3);
    assert.equal(skillModifier(2, "none", 3), 2);
    assert.equal(skillModifier(2, "proficient", 3), 5);
    assert.equal(skillModifier(3, "expertise", 3), 9);
  });

  it("computes passive scores, spell save DC and spell attack bonus", () => {
    assert.equal(passiveScore(5), 15);
    // Wizard 5, INT 16: DC = 8 + 3 (prof) + 3 (INT) = 14, attack = +6
    assert.equal(spellSaveDc(3, 3), 14);
    assert.equal(spellAttackBonus(3, 3), 6);
  });

  it("derives full stats for a level 5 wizard fixture", () => {
    const derived = computeCharacterDerivedStats({
      abilities: WIZARD_5_ABILITIES,
      level: 5,
      skills: {
        proficiencies: ["perception", "arcana", "stealth"],
        expertise: ["stealth"],
        savingThrows: ["intelligence", "wisdom"],
      },
      spellcasting: { ability: "intelligence" },
      classes: [{ name: "Wizard", level: 5 }],
    });

    // Passive Perception: 10 + WIS(+1) + prof(+3) = 14
    assert.equal(derived.passivePerception, 14);
    // Passive Investigation (ungeübt): 10 + INT(+3) = 13
    assert.equal(derived.passiveInvestigation, 13);
    // Passive Insight (ungeübt): 10 + WIS(+1) = 11
    assert.equal(derived.passiveInsight, 11);

    const intSave = derived.savingThrows.find((save) => save.ability === "intelligence");
    const strSave = derived.savingThrows.find((save) => save.ability === "strength");
    assert.equal(intSave?.modifier, 6);
    assert.equal(intSave?.proficient, true);
    assert.equal(strSave?.modifier, -1);
    assert.equal(strSave?.proficient, false);

    const stealth = derived.skills.find((skill) => skill.key === "stealth");
    assert.equal(stealth?.proficiency, "expertise");
    // DEX(+2) + 2×prof(+6) = +8, passive 18
    assert.equal(stealth?.modifier, 8);
    assert.equal(stealth?.passive, 18);

    assert.equal(derived.spellcastingAbility, "intelligence");
    assert.equal(derived.spellSaveDc, 14);
    assert.equal(derived.spellAttackBonus, 6);
  });

  it("infers the spellcasting ability from classes (highest level wins)", () => {
    assert.equal(inferSpellcastingAbility([{ name: "Paladin", level: 6 }]), "charisma");
    assert.equal(inferSpellcastingAbility([{ name: "Kleriker", level: 3 }]), "wisdom");
    assert.equal(
      inferSpellcastingAbility([
        { name: "Wizard", level: 3 },
        { name: "Paladin", level: 2 },
      ]),
      "intelligence",
    );
    assert.equal(inferSpellcastingAbility([{ name: "Fighter", level: 5 }]), null);
    assert.equal(inferSpellcastingAbility(null), null);
  });

  it("returns no spellcasting stats when ability is none or unknown", () => {
    const derived = computeCharacterDerivedStats({
      abilities: WIZARD_5_ABILITIES,
      level: 5,
      spellcasting: { ability: "none" },
      classes: [{ name: "Wizard", level: 5 }],
    });
    assert.equal(derived.spellcastingAbility, null);
    assert.equal(derived.spellSaveDc, null);
    assert.equal(derived.spellAttackBonus, null);

    const noCaster = computeCharacterDerivedStats({
      abilities: WIZARD_5_ABILITIES,
      level: 5,
      classes: [{ name: "Fighter", level: 5 }],
    });
    assert.equal(noCaster.spellcastingAbility, null);
    assert.equal(noCaster.spellSaveDc, null);
  });

  it("parses skill profile and spellcasting config tolerantly", () => {
    assert.deepEqual(parseCharacterSkillProfile(null), {
      proficiencies: [],
      expertise: [],
      savingThrows: [],
    });
    assert.deepEqual(
      parseCharacterSkillProfile({
        proficiencies: ["perception", "not-a-skill", "perception"],
        expertise: 42,
        savingThrows: ["dexterity", "luck"],
      }),
      { proficiencies: ["perception"], expertise: [], savingThrows: ["dexterity"] },
    );
    assert.deepEqual(parseSpellcastingConfig(null), { ability: "auto" });
    assert.deepEqual(parseSpellcastingConfig({ ability: "banana" }), { ability: "auto" });
    assert.deepEqual(parseSpellcastingConfig({ ability: "none" }), { ability: "none" });
    assert.deepEqual(parseSpellcastingConfig({ ability: "charisma" }), { ability: "charisma" });
  });

  it("extracts proficiency form input without wiping unrelated updates", () => {
    assert.deepEqual(extractCharacterProficiencyFormInput({ level: 3 }), {});

    const extracted = extractCharacterProficiencyFormInput({
      skill_perception: "proficient",
      skill_stealth: "expertise",
      skill_arcana: "none",
      save_wisdom: "proficient",
      save_strength: "none",
      spellcastingAbility: "wisdom",
    });
    assert.deepEqual(extracted.skills, {
      proficiencies: ["perception", "stealth"],
      expertise: ["stealth"],
      savingThrows: ["wisdom"],
    });
    assert.deepEqual(extracted.spellcasting, { ability: "wisdom" });

    const noneCaster = extractCharacterProficiencyFormInput({ spellcastingAbility: "none" });
    assert.equal(noneCaster.skills, undefined);
    assert.deepEqual(noneCaster.spellcasting, { ability: "none" });

    const autoCaster = extractCharacterProficiencyFormInput({ spellcastingAbility: "auto" });
    assert.deepEqual(autoCaster.spellcasting, { ability: "auto" });
  });

  it("includes derived stats in the sheet snapshot", () => {
    const snapshot = buildCharacterSheetSnapshot({
      id: "char-1",
      displayName: "Mira",
      level: 5,
      rulesEdition: "dnd5e_2024",
      abilities: WIZARD_5_ABILITIES as unknown as Record<string, number>,
      combat: { armorClass: 15, initiativeBonus: 0 },
      skills: {
        proficiencies: ["perception"],
        expertise: [],
        savingThrows: ["intelligence"],
      },
      spellcasting: { ability: "auto" },
      classes: [{ name: "Wizard", level: 5 }],
      ownerUserId: "user-1",
      pageId: null,
    });

    assert.equal(snapshot.derived.passivePerception, 14);
    assert.equal(snapshot.derived.spellcastingAbility, "intelligence");
    assert.equal(snapshot.derived.spellSaveDc, 14);
    assert.equal(snapshot.derived.spellAttackBonus, 6);
    assert.equal(snapshot.initiative, 2);
  });

  it("computes spell slots for full, half and third casters", () => {
    // Full caster: Wizard 5 → 4/3/2
    const wizard = computeSpellSlots(5, [{ name: "Wizard", level: 5 }]);
    assert.equal(wizard.casterLevel, 5);
    assert.deepEqual(wizard.byLevel, { 1: 4, 2: 3, 3: 2 });

    // Half caster: Paladin 6 → caster level 3 → 4/2
    const paladin = computeSpellSlots(6, [{ name: "Paladin", level: 6 }]);
    assert.equal(paladin.casterLevel, 3);
    assert.deepEqual(paladin.byLevel, { 1: 4, 2: 2 });

    // Third caster: Eldritch Knight 9 → caster level 3 → 4/2
    const knight = computeSpellSlots(9, [{ name: "Eldritch Knight", level: 9 }]);
    assert.equal(knight.casterLevel, 3);
    assert.deepEqual(knight.byLevel, { 1: 4, 2: 2 });

    // Multiclass: Wizard 3 + Paladin 4 → 3 + 2 = caster level 5
    const multi = computeSpellSlots(7, [
      { name: "Wizard", level: 3 },
      { name: "Paladin", level: 4 },
    ]);
    assert.equal(multi.casterLevel, 5);
    assert.deepEqual(multi.byLevel, { 1: 4, 2: 3, 3: 2 });
  });
});
