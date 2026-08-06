import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { ABILITIES, SKILLS } from "./types";

/**
 * Zwei Listen, die deckungsgleich bleiben müssen.
 *
 * Der Charakterbogen kennt seine Fertigkeiten aus `SKILL_DEFINITIONS`
 * (`packages/database/src/character-service.ts`), der Ersteller aus `SKILLS`
 * hier. Beide beschreiben dieselben achtzehn Fertigkeiten — aber das Paket
 * darf `@uwe/database` nicht importieren, weil es sonst den Server-Barrel
 * ins Browser-Bündel zöge.
 *
 * Statt die Kopplung zu bauen, prüft dieser Test sie: Er liest die
 * Quelldatei und vergleicht die Schlüssel. Wer eine Fertigkeit auf einer
 * Seite hinzufügt und auf der anderen vergisst, bekommt einen roten Build
 * statt einer Fertigkeit, die im Bogen fehlt.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const characterServicePath = path.resolve(
  here,
  "../../database/src/character-service.ts",
);

function readKeys(pattern: RegExp, source: string): string[] {
  const keys: string[] = [];
  for (const match of source.matchAll(pattern)) {
    keys.push(match[1]);
  }
  return keys;
}

describe("Fertigkeiten decken sich mit dem Charakterbogen", () => {
  const source = fs.readFileSync(characterServicePath, "utf8");

  it("findet die Quelldatei überhaupt", () => {
    assert.ok(
      source.includes("SKILL_DEFINITIONS"),
      `In ${characterServicePath} steht kein SKILL_DEFINITIONS mehr — ` +
        "wurde der Bogen umgebaut? Dann gehört dieser Test nachgezogen.",
    );
  });

  it("kennt dieselben achtzehn Schlüssel", () => {
    const fromSheet = readKeys(/\{\s*key:\s*"([a-z_]+)",\s*ability:/g, source);

    assert.equal(fromSheet.length, 18, "Der Bogen führt nicht mehr achtzehn Fertigkeiten");
    assert.deepEqual(
      [...fromSheet].sort(),
      [...SKILLS].sort(),
      "Fertigkeitsliste des Erstellers weicht vom Charakterbogen ab",
    );
  });

  it("kennt dieselben sechs Attribute", () => {
    const fromSheet = readKeys(/^\s*"(strength|dexterity|constitution|intelligence|wisdom|charisma)",$/gm, source);

    assert.deepEqual(
      [...new Set(fromSheet)].sort(),
      [...ABILITIES].sort(),
      "Attributsliste des Erstellers weicht vom Charakterbogen ab",
    );
  });
});
