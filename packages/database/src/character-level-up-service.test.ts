import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLevelUpApplyPayload,
  buildLevelUpSuggestions,
  getClassHitDie,
  PICKABLE_CLASSES,
} from "./character-level-up-service";

describe("character level-up service", () => {
  it("suggests HP, proficiency, and spell slot changes for wizard 4→5", () => {
    const suggestions = buildLevelUpSuggestions({
      level: 4,
      classes: [{ name: "Wizard", level: 4 }],
      abilities: { constitution: 14 },
      combat: { maxHp: 24, currentHp: 18 },
    });

    assert.ok(suggestions);
    assert.equal(suggestions.fromLevel, 4);
    assert.equal(suggestions.toLevel, 5);
    assert.equal(suggestions.suggestedHpIncrease, 6);
    assert.match(suggestions.hpRollHint, /1W6\+2/);

    const levelField = suggestions.fields.find((field) => field.key === "level");
    assert.equal(levelField?.suggestedDisplay, "5");

    const maxHpField = suggestions.fields.find((field) => field.key === "maxHp");
    assert.equal(maxHpField?.suggestedDisplay, "30");

    const profField = suggestions.fields.find((field) => field.key === "proficiencyBonus");
    assert.equal(profField?.currentDisplay, "+2");
    assert.equal(profField?.suggestedDisplay, "+3");
    assert.equal(profField?.applyable, false);

    const slotsField = suggestions.fields.find((field) => field.key === "spellSlots");
    assert.ok(slotsField);
    assert.match(slotsField?.suggestedDisplay ?? "", /Grad 3: 2/);
  });

  it("requires class picker when classes JSON is empty", () => {
    const suggestions = buildLevelUpSuggestions(
      {
        level: 1,
        classes: null,
        abilities: { constitution: 10 },
        combat: {},
      },
      { pickedClass: "Kämpfer" },
    );

    assert.ok(suggestions);
    assert.equal(suggestions.needsClassPicker, true);
    assert.deepEqual([...suggestions.classOptions], [...PICKABLE_CLASSES]);

    const classesField = suggestions.fields.find((field) => field.key === "classes");
    assert.equal(classesField?.currentDisplay, "—");
    assert.equal(classesField?.suggestedDisplay, "Kämpfer 2");
    assert.equal(getClassHitDie("Kämpfer"), 10);
  });

  it("applies only selected level-up fields", () => {
    const payload = buildLevelUpApplyPayload(
      {
        level: 2,
        classes: [{ name: "Paladin", level: 2 }],
        abilities: { constitution: 12 },
        combat: { maxHp: 20, currentHp: 12 },
      },
      {
        applyLevel: true,
        applyMaxHp: true,
        applyCurrentHp: false,
        applyClasses: true,
        hpIncrease: 6,
      },
    );

    assert.ok(payload);
    assert.equal(payload.level, 3);
    assert.deepEqual(payload.classes, [{ name: "Paladin", level: 3 }]);
    assert.equal(payload.combat?.maxHp, 26);
    assert.equal(payload.combat?.currentHp, undefined);
  });

  it("returns null when max level reached", () => {
    assert.equal(
      buildLevelUpSuggestions({
        level: 30,
        classes: [{ name: "Fighter", level: 30 }],
        abilities: {},
        combat: {},
      }),
      null,
    );
  });

  it("returns null when nothing selected to apply", () => {
    assert.equal(
      buildLevelUpApplyPayload(
        {
          level: 3,
          classes: [{ name: "Wizard", level: 3 }],
          abilities: {},
          combat: { maxHp: 18 },
        },
        {
          applyLevel: false,
          applyMaxHp: false,
          applyClasses: false,
        },
      ),
      null,
    );
  });
});
