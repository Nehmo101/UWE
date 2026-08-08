import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OWNER_NOTES_SOURCE } from "../types";
import { findInvention, INVENTIONS_ERFINDER, inventionsForLevel } from "./index";

/** Snapshot: Stufe-1-Inventionen für Erfinder-Level-1-Wahl im Wizard. */
const LEVEL1_INVENTION_KEYS = [
  "arm_launcher",
  "enhanced_arcane_focus",
  "enhanced_defense",
  "enhanced_weapon",
  "featherweight_belt",
  "featherweight_weapon",
  "goggles_of_clearsight",
  "homunculus_servant",
  "lightning_cannon",
  "power_whip",
  "repeating_shot",
  "returning_weapon",
] as const;

function duplicates(keys: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  }
  return [...dupes];
}

describe("INVENTIONS_ERFINDER", () => {
  it("hat eindeutige Schlüssel", () => {
    assert.deepEqual(duplicates(INVENTIONS_ERFINDER.map((entry) => entry.key)), []);
  });

  it("alle Inventionen tragen OWNER_NOTES_SOURCE", () => {
    assert.ok(INVENTIONS_ERFINDER.length >= 38);
    for (const entry of INVENTIONS_ERFINDER) {
      assert.equal(entry.source, OWNER_NOTES_SOURCE, entry.key);
    }
  });

  it("findInvention löst bekannte Schlüssel auf", () => {
    const entry = findInvention("enhanced_weapon");
    assert.ok(entry);
    assert.equal(entry.nameEn, "Enhanced Weapon");
    assert.equal(entry.prerequisiteLevel, 1);
  });

  it("findInvention gibt undefined für unbekannte Schlüssel", () => {
    assert.equal(findInvention("not_an_invention"), undefined);
  });

  it("inventionsForLevel(1) liefert genau die bekannte Stufe-1-Menge", () => {
    const level1 = inventionsForLevel(1);
    assert.equal(level1.length, LEVEL1_INVENTION_KEYS.length);
    assert.deepEqual(
      level1.map((entry) => entry.key).sort(),
      [...LEVEL1_INVENTION_KEYS].sort(),
    );
    assert.ok(level1.every((entry) => entry.prerequisiteLevel <= 1));
    assert.ok(!level1.some((entry) => entry.key === "gem_of_warding"));
  });

  it("höhere Inventionen erscheinen erst ab ihrer Stufe", () => {
    assert.ok(!inventionsForLevel(1).some((entry) => entry.prerequisiteLevel > 1));
    const level5 = inventionsForLevel(5);
    assert.ok(level5.some((entry) => entry.key === "gem_of_warding"));
    assert.ok(level5.every((entry) => entry.prerequisiteLevel <= 5));
  });
});
