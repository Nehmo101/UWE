import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCustomBackground,
  checkCustomBackground,
  classesWithoutMatchingBackground,
  CUSTOM_BACKGROUND_GOLD,
  CUSTOM_BACKGROUND_KEY,
  emptyCustomBackground,
  type CustomBackgroundDraft,
} from "./custom-background";
import { BACKGROUNDS, CLASSES, originFeats, resolveBackground } from "../content";
import { isBackgroundBonusValid } from "./derive";
import type { Feat } from "../types";

const FEATS = originFeats();
const A_FEAT = FEATS[0]?.key ?? "wachsam";

function complete(overrides: Partial<CustomBackgroundDraft> = {}): CustomBackgroundDraft {
  return {
    name: "Grenzwächterin",
    abilityOptions: ["strength", "charisma", "constitution"],
    skills: ["athletics", "perception"],
    toolProficiency: "Schmiedewerkzeug",
    originFeat: A_FEAT,
    ...overrides,
  };
}

describe("Der Engpass, den der Eigenbau löst", () => {
  it("die vier SRD-Hintergründe decken nicht jede Klasse ab", () => {
    const stranded = classesWithoutMatchingBackground(CLASSES, BACKGROUNDS);

    // Das ist kein Wunsch, sondern der Befund: Für diese Klassen hebt kein
    // einziger SRD-Hintergrund beide Primärattribute an.
    assert.ok(
      stranded.length > 0,
      "Wenn das hier leer ist, deckt der Katalog plötzlich alles ab — " +
        "dann gehört dieser Test überprüft, nicht gelöscht.",
    );

    const names = stranded.map((entry) => entry.key).sort();

    /*
     * Genau drei — und die Zahl ist wichtiger, als sie aussieht.
     *
     * Eine erste Sichtprüfung behauptete fünf und zählte Barde und
     * Hexenpakt-Magier mit. Beide führen im SRD 2024 aber nur EIN
     * Primärattribut (Charisma), und das deckt der Akolyth ab. Betroffen sind
     * nur Klassen mit zwei Primärattributen, deren Paarung in keinem der vier
     * Hintergründe zusammen vorkommt.
     */
    assert.deepEqual(names, ["moench", "paladin", "waldlaeufer"]);
  });

  it("mit Eigenbau findet jede Klasse eine passende Verteilung", () => {
    for (const entry of CLASSES) {
      const built = buildCustomBackground(
        complete({ abilityOptions: pad(entry.primaryAbilities) }),
        FEATS,
      );
      assert.ok(built, `${entry.name}: Eigenbau ließ sich nicht bauen`);
      for (const ability of entry.primaryAbilities) {
        assert.ok(
          built.abilityOptions.includes(ability),
          `${entry.name}: ${ability} fehlt im Eigenbau`,
        );
      }
    }
  });
});

/** Primärattribute auf genau drei auffüllen, ohne Dubletten. */
function pad(abilities: readonly string[]): CustomBackgroundDraft["abilityOptions"] {
  const filler = ["constitution", "dexterity", "wisdom", "intelligence", "charisma", "strength"];
  const out = [...new Set(abilities)] as CustomBackgroundDraft["abilityOptions"];
  for (const candidate of filler) {
    if (out.length >= 3) break;
    if (!out.includes(candidate as never)) out.push(candidate as never);
  }
  return out.slice(0, 3);
}

describe("Der Bauplan prüft, was das Regelwerk verlangt", () => {
  it("ein leerer Bauplan nennt alles, was fehlt", () => {
    const result = checkCustomBackground(emptyCustomBackground(), FEATS);
    assert.equal(result.complete, false);
    assert.ok(result.issues.length >= 4, "Name, Attribute, Fertigkeiten, Werkzeug, Talent");
  });

  it("genau drei Attribute — nicht zwei, nicht vier", () => {
    assert.equal(
      checkCustomBackground(complete({ abilityOptions: ["strength", "charisma"] }), FEATS).complete,
      false,
    );
    assert.equal(
      checkCustomBackground(
        complete({ abilityOptions: ["strength", "charisma", "wisdom", "dexterity"] }),
        FEATS,
      ).complete,
      false,
      "vier Attribute sind kein gültiger Bauplan",
    );
  });

  it("doppelte Einträge zählen einmal und fallen damit durch", () => {
    const result = checkCustomBackground(
      complete({ abilityOptions: ["strength", "strength", "charisma"] }),
      FEATS,
    );
    assert.equal(result.complete, false, "zweimal STÄ sind nicht drei Attribute");
  });

  it("genau zwei Fertigkeiten", () => {
    assert.equal(
      checkCustomBackground(complete({ skills: ["athletics"] }), FEATS).complete,
      false,
    );
  });

  it("das Ursprungstalent muss es geben", () => {
    assert.equal(
      checkCustomBackground(complete({ originFeat: "gibt-es-nicht" }), FEATS).complete,
      false,
    );
    assert.equal(
      checkCustomBackground(complete(), [] as readonly Feat[]).complete,
      false,
      "ohne wählbare Talente ist kein Bauplan gültig",
    );
  });

  it("ein vollständiger Bauplan geht durch", () => {
    assert.equal(checkCustomBackground(complete(), FEATS).complete, true);
  });
});

describe("Aus dem Bauplan wird ein echter Hintergrund", () => {
  it("unvollständig ergibt null statt eines halben Hintergrunds", () => {
    assert.equal(buildCustomBackground(emptyCustomBackground(), FEATS), null);
    assert.equal(buildCustomBackground(null, FEATS), null);
  });

  it("vollständig ergibt einen Hintergrund mit 50 Goldmünzen", () => {
    const built = buildCustomBackground(complete(), FEATS);
    assert.ok(built);
    assert.equal(built.key, CUSTOM_BACKGROUND_KEY);
    assert.equal(built.name, "Grenzwächterin");
    assert.equal(built.startingGold, CUSTOM_BACKGROUND_GOLD);
    assert.deepEqual(built.skills, ["athletics", "perception"]);
    assert.equal(built.abilityOptions.length, 3);
  });

  it("der gebaute Hintergrund trägt dieselbe Bonusregel wie ein Katalog-Eintrag", () => {
    const built = buildCustomBackground(complete(), FEATS);
    assert.ok(built);
    // +2/+1 auf zwei der drei gewählten Attribute
    assert.equal(isBackgroundBonusValid(built, { strength: 2, charisma: 1 }), true);
    // +1/+1/+1 auf alle drei
    assert.equal(
      isBackgroundBonusValid(built, { strength: 1, charisma: 1, constitution: 1 }),
      true,
    );
    // ein Attribut, das gar nicht gewählt wurde
    assert.equal(isBackgroundBonusValid(built, { wisdom: 2, charisma: 1 }), false);
    // falsche Summe
    assert.equal(isBackgroundBonusValid(built, { strength: 2, charisma: 2 }), false);
  });
});

describe("Auflösung im Entwurf", () => {
  it("holt Katalog-Hintergründe wie bisher", () => {
    const resolved = resolveBackground({ backgroundKey: "soldat", customBackground: null });
    assert.equal(resolved?.key, "soldat");
  });

  it("baut den Eigenbau, wenn der Schlüssel darauf zeigt", () => {
    const resolved = resolveBackground({
      backgroundKey: CUSTOM_BACKGROUND_KEY,
      customBackground: complete(),
    });
    assert.equal(resolved?.name, "Grenzwächterin");
  });

  it("gibt null, solange der Eigenbau unfertig ist", () => {
    const resolved = resolveBackground({
      backgroundKey: CUSTOM_BACKGROUND_KEY,
      customBackground: emptyCustomBackground(),
    });
    assert.equal(resolved, null);
  });

  it("ohne Hintergrund bleibt es null", () => {
    assert.equal(resolveBackground({ backgroundKey: null, customBackground: null }), null);
  });
});
