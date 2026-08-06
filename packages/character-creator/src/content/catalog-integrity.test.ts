import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALIGNMENTS,
  BACKGROUNDS,
  CLASSES,
  EQUIPMENT_PACKS,
  FEATS,
  findFeat,
  LANGUAGES,
  SPECIES,
  SPELLS,
  spellsForClass,
} from "./index";
import { ABILITIES, SKILLS } from "../types";

/**
 * Der Katalog verweist auf sich selbst: Hintergründe auf Talente, Zauber auf
 * Klassen, Klassen auf Fertigkeiten. Solche Verweise brechen leise — ein
 * Tippfehler im Klassenschlüssel macht keine Fehlermeldung, sondern eine
 * Zauberliste, die im Ersteller einfach leer bleibt.
 *
 * Deshalb prüft diese Datei die Kanten zwischen den Inhalten, nicht die
 * Inhalte selbst. Ob „Feuerball" 8W6 Schaden macht, steht hier nicht zur
 * Debatte — das ist Sache der Quellenprüfung (siehe
 * docs/engineering/character-creator-missing-data.md, § 7).
 */

function duplicates(keys: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  }
  return [...dupes];
}

describe("Schlüssel sind eindeutig", () => {
  const catalogs: Array<[string, Array<{ key: string }>]> = [
    ["Völker", SPECIES],
    ["Klassen", CLASSES],
    ["Hintergründe", BACKGROUNDS],
    ["Talente", FEATS],
    ["Zauber", SPELLS],
    ["Ausrüstungspakete", EQUIPMENT_PACKS],
    ["Sprachen", LANGUAGES],
    ["Gesinnungen", ALIGNMENTS],
  ];

  for (const [label, entries] of catalogs) {
    it(`${label}: keine doppelten Schlüssel`, () => {
      assert.deepEqual(duplicates(entries.map((entry) => entry.key)), []);
    });

    it(`${label}: Schlüssel sind ASCII-klein ohne Umlaute`, () => {
      const offenders = entries
        .map((entry) => entry.key)
        .filter((key) => !/^[a-z0-9][a-z0-9_-]*$/.test(key));
      assert.deepEqual(offenders, []);
    });
  }
});

describe("Verweise gehen ins Leere", () => {
  it("jedes Ursprungstalent eines Hintergrunds existiert", () => {
    const broken = BACKGROUNDS.filter((background) => !findFeat(background.originFeat)).map(
      (background) => `${background.key} → ${background.originFeat}`,
    );
    assert.deepEqual(broken, []);
  });

  it("jede Zauberliste nennt nur echte Klassenschlüssel", () => {
    const classKeys = new Set(CLASSES.map((entry) => entry.key));
    const unknown = new Set<string>();
    for (const spell of SPELLS) {
      for (const list of spell.lists) {
        if (!classKeys.has(list)) unknown.add(list);
      }
    }
    assert.deepEqual([...unknown], []);
  });

  it("jeder Zauber steht auf mindestens einer Klassenliste", () => {
    const orphans = SPELLS.filter((spell) => spell.lists.length === 0).map((spell) => spell.key);
    assert.deepEqual(orphans, [], "Ein Zauber ohne Liste ist im Ersteller unerreichbar");
  });

  it("jede Klasse nennt nur echte Fertigkeiten und Attribute", () => {
    const skills = new Set<string>(SKILLS);
    const abilities = new Set<string>(ABILITIES);
    for (const entry of CLASSES) {
      for (const skill of entry.skills.from) {
        assert.ok(skills.has(skill), `${entry.key}: unbekannte Fertigkeit ${skill}`);
      }
      for (const ability of [...entry.savingThrows, ...entry.primaryAbilities]) {
        assert.ok(abilities.has(ability), `${entry.key}: unbekanntes Attribut ${ability}`);
      }
    }
  });

  it("jeder Hintergrund nennt drei echte Attribute und zwei echte Fertigkeiten", () => {
    const skills = new Set<string>(SKILLS);
    const abilities = new Set<string>(ABILITIES);
    for (const entry of BACKGROUNDS) {
      assert.equal(
        entry.abilityOptions.length,
        3,
        `${entry.key}: 2024 nennt genau drei Attribute zur Wahl`,
      );
      for (const ability of entry.abilityOptions) {
        assert.ok(abilities.has(ability), `${entry.key}: unbekanntes Attribut ${ability}`);
      }
      for (const skill of entry.skills) {
        assert.ok(skills.has(skill), `${entry.key}: unbekannte Fertigkeit ${skill}`);
      }
    }
  });
});

describe("Der Ersteller kann jeden Schritt zu Ende bringen", () => {
  it("jede Zauberklasse findet genug Zaubertricks und Zauber des 1. Grades", () => {
    for (const entry of CLASSES) {
      const spellcasting = entry.spellcasting;
      if (!spellcasting) continue;

      const cantrips = spellsForClass(entry.key, 0).length;
      const level1 = spellsForClass(entry.key, 1).length;

      assert.ok(
        cantrips >= spellcasting.cantripsKnown,
        `${entry.name}: braucht ${spellcasting.cantripsKnown} Zaubertricks, der Katalog bietet ${cantrips}`,
      );
      assert.ok(
        level1 >= spellcasting.spellsKnownAtFirst,
        `${entry.name}: braucht ${spellcasting.spellsKnownAtFirst} Zauber, der Katalog bietet ${level1}`,
      );
    }
  });

  it("jede Klasse bietet mindestens so viele Fertigkeiten an, wie sie wählen lässt", () => {
    for (const entry of CLASSES) {
      const available = entry.skills.from.length === 0 ? SKILLS.length : entry.skills.from.length;
      assert.ok(
        available >= entry.skills.choose,
        `${entry.name}: wählt ${entry.skills.choose} aus ${available}`,
      );
    }
  });

  it("jede Klasse hat mindestens eine Unterklasse und eine Startausrüstung", () => {
    for (const entry of CLASSES) {
      assert.ok(entry.subclasses.length > 0, `${entry.name}: keine Unterklasse`);
      assert.ok(entry.startingEquipment.length > 0, `${entry.name}: keine Startausrüstung`);
    }
  });

  it("jede Spezies mit Abstammungen bietet mehr als eine an", () => {
    for (const entry of SPECIES) {
      if (!entry.lineages) continue;
      assert.ok(
        entry.lineages.length > 1,
        `${entry.name}: eine einzige Abstammung ist keine Wahl`,
      );
    }
  });
});
