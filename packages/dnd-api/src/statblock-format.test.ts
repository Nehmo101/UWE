import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatOpen5eMonsterAsMarkdown } from "./statblock-format";

describe("formatOpen5eMonsterAsMarkdown", () => {
  it("formats a minimal Open5e monster as markdown", () => {
    const markdown = formatOpen5eMonsterAsMarkdown({
      name: "Goblin",
      size: "Small",
      type: "humanoid",
      subtype: "goblinoid",
      alignment: "neutral evil",
      armor_class: 15,
      hit_points: 7,
      hit_dice: "2d6",
      speed: { walk: 30 },
      strength: 8,
      dexterity: 14,
      constitution: 10,
      intelligence: 10,
      wisdom: 8,
      charisma: 8,
      challenge_rating: "1/4",
      actions: [
        {
          name: "Scimitar",
          desc: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.",
        },
      ],
    });

    assert.match(markdown, /^# Goblin/m);
    assert.match(markdown, /Rüstungsklasse.*15/);
    assert.match(markdown, /Trefferpunkte.*7 \(2d6\)/);
    assert.match(markdown, /Geschwindigkeit.*walk 30 ft\./);
    assert.match(markdown, /STR 8/);
    assert.match(markdown, /## Aktionen/);
    assert.match(markdown, /\*\*Scimitar\.\*\*/);
  });

  it("handles invalid input gracefully", () => {
    const markdown = formatOpen5eMonsterAsMarkdown(null);
    assert.match(markdown, /Unbekanntes Monster/);
  });
});
