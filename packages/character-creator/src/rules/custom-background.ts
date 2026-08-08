/**
 * Der Eigenbau-Hintergrund.
 *
 * Historisch deckten die vier SRD-Hintergründe nicht jede Primärattribut-
 * Paarung ab (Paladin, Mönch, Waldläufer). Seit dem Import der zwölf
 * Owner-Notizen-Hintergründe (`backgrounds-extended.ts`) findet jede
 * Standardklasse im Katalog eine passende Verteilung — der Eigenbau bleibt
 * trotzdem: für Kampagnen-Sonderfälle und Spieler, die bewusst abweichen.
 *
 * Der Bauplan steht im SRD selbst und ist lizenziert:
 *
 *   1. Drei Attribute wählen; darauf +2/+1 oder +1/+1/+1 verteilen.
 *   2. Zwei Fertigkeiten wählen.
 *   3. Eine Werkzeugkunde wählen.
 *   4. Ein Ursprungstalent wählen.
 *   5. Ausrüstung im Wert von 50 GM — hier als Startgold abgebildet.
 *
 * Ergebnis ist ein ganz normaler `Background`. Alles dahinter (Vorschau,
 * Prüfung, Anlegen) sieht keinen Unterschied zu einem Katalog-Hintergrund.
 */

import {
  ABILITIES,
  SKILLS,
  SRD_SOURCE,
  type AbilityKey,
  type Background,
  type Feat,
  type SkillKey,
} from "../types";

/** Der Schlüssel, unter dem ein Eigenbau im Entwurf steht. */
export const CUSTOM_BACKGROUND_KEY = "eigener-hintergrund";

/** Das SRD gibt dem Eigenbau 50 GM statt einer Ausrüstungsliste. */
export const CUSTOM_BACKGROUND_GOLD = 50;

/** Wie viele Attribute, Fertigkeiten und Talente der Bauplan verlangt. */
export const CUSTOM_ABILITY_COUNT = 3;
export const CUSTOM_SKILL_COUNT = 2;

/**
 * Werkzeugkunden zur Auswahl.
 *
 * Das SRD nennt für den Eigenbau „eine Art Handwerkszeug". Die Liste hier ist
 * die der Handwerkszeuge aus dem Ausrüstungskapitel, ergänzt um die beiden
 * Werkzeuge, die die vier Katalog-Hintergründe vergeben — sonst könnte ein
 * Eigenbau weniger, als ein Katalogeintrag darf.
 */
export const CUSTOM_TOOL_OPTIONS = [
  "Alchemistenbedarf",
  "Braumeisterbedarf",
  "Kalligrafiewerkzeug",
  "Zimmermannswerkzeug",
  "Kartografenwerkzeug",
  "Schusterwerkzeug",
  "Kochgeschirr",
  "Glasbläserwerkzeug",
  "Juwelierswerkzeug",
  "Lederwerkzeug",
  "Maurerwerkzeug",
  "Malerbedarf",
  "Töpferwerkzeug",
  "Schmiedewerkzeug",
  "Fallenstellerwerkzeug",
  "Weberwerkzeug",
  "Holzschnitzwerkzeug",
  "Diebeswerkzeug",
  "Ein Spielset deiner Wahl",
  "Ein Musikinstrument deiner Wahl",
] as const;

/** Was der Spieler im Schritt „Hintergrund" zusammenstellt. */
export interface CustomBackgroundDraft {
  /** Freier Name — „Grenzwächterin", „Hafenschreiber". */
  name: string;
  /** Genau drei Attribute, auf die später +2/+1 oder +1/+1/+1 fällt. */
  abilityOptions: AbilityKey[];
  /** Genau zwei Fertigkeiten. */
  skills: SkillKey[];
  toolProficiency: string;
  /** Schlüssel eines Talents mit `category === "origin"`. */
  originFeat: string;
}

/**
 * Dieselbe Form, aber ungeprüft.
 *
 * So kommt der Bauplan über die Leitung: Die zod-Schicht hält Größe und
 * Zeichenvorrat in Schach, kennt aber die Attributs- und Fertigkeitsschlüssel
 * nicht. Das Einengen macht der Bauplan selbst — `uniqueValid` wirft alles
 * weg, was nicht in den Katalog gehört. Deshalb nehmen `checkCustomBackground`
 * und `buildCustomBackground` diese weite Form an; die enge
 * `CustomBackgroundDraft` ist die der Oberfläche.
 */
export interface CustomBackgroundInput {
  name: string;
  abilityOptions: readonly string[];
  skills: readonly string[];
  toolProficiency: string;
  originFeat: string;
}

export function emptyCustomBackground(): CustomBackgroundDraft {
  return {
    name: "",
    abilityOptions: [],
    skills: [],
    toolProficiency: "",
    originFeat: "",
  };
}

export interface CustomBackgroundProblems {
  /** Deutsche Hinweise in der Reihenfolge, in der man sie abarbeitet. */
  issues: string[];
  complete: boolean;
}

/**
 * Prüft den Bauplan.
 *
 * `originFeats` wird hereingereicht statt importiert, damit die Regel den
 * Katalog nicht kennen muss — dieselbe Trennung wie im Rest des Pakets.
 */
export function checkCustomBackground(
  draft: CustomBackgroundInput | null,
  originFeats: readonly Feat[],
): CustomBackgroundProblems {
  const issues: string[] = [];

  if (!draft) {
    return { issues: ["Stelle deinen Hintergrund zusammen."], complete: false };
  }

  if (!draft.name.trim()) {
    issues.push("Gib deinem Hintergrund einen Namen.");
  }

  const abilities = uniqueValid(draft.abilityOptions, ABILITIES);
  if (abilities.length !== CUSTOM_ABILITY_COUNT) {
    const missing = CUSTOM_ABILITY_COUNT - abilities.length;
    issues.push(
      missing > 0
        ? `Wähle noch ${missing} ${missing === 1 ? "Attribut" : "Attribute"} (genau drei).`
        : "Wähle genau drei Attribute.",
    );
  }

  const skills = uniqueValid(draft.skills, SKILLS);
  if (skills.length !== CUSTOM_SKILL_COUNT) {
    const missing = CUSTOM_SKILL_COUNT - skills.length;
    issues.push(
      missing > 0
        ? `Wähle noch ${missing} ${missing === 1 ? "Fertigkeit" : "Fertigkeiten"} (genau zwei).`
        : "Wähle genau zwei Fertigkeiten.",
    );
  }

  if (!draft.toolProficiency.trim()) {
    issues.push("Wähle eine Werkzeugkunde.");
  }

  if (!originFeats.some((feat) => feat.key === draft.originFeat)) {
    issues.push("Wähle ein Ursprungstalent.");
  }

  return { issues, complete: issues.length === 0 };
}

function uniqueValid<T extends string>(values: readonly string[], allowed: readonly T[]): T[] {
  const set = new Set<T>();
  for (const value of values) {
    if ((allowed as readonly string[]).includes(value)) set.add(value as T);
  }
  return [...set];
}

/**
 * Macht aus dem Bauplan einen echten `Background`.
 *
 * Gibt `null` zurück, solange der Bauplan unvollständig ist — ein halb
 * gebauter Hintergrund darf nicht als fertiger durchgehen, sonst rechnet die
 * Vorschau mit Attributen, die der Spieler nie gewählt hat.
 */
export function buildCustomBackground(
  draft: CustomBackgroundInput | null,
  originFeats: readonly Feat[],
): Background | null {
  if (!draft) return null;
  if (!checkCustomBackground(draft, originFeats).complete) return null;

  const abilities = uniqueValid(draft.abilityOptions, ABILITIES);
  const skills = uniqueValid(draft.skills, SKILLS);

  return {
    key: CUSTOM_BACKGROUND_KEY,
    name: draft.name.trim(),
    nameEn: draft.name.trim(),
    hook: "Selbst gebaut — nach dem Bauplan aus dem Regelwerk.",
    description:
      "Dieser Hintergrund wurde nach dem Bauplan für eigene Hintergründe " +
      "zusammengestellt: drei Attribute, zwei Fertigkeiten, eine Werkzeugkunde, " +
      "ein Ursprungstalent und Ausrüstung im Wert von 50 Goldmünzen.",
    source: SRD_SOURCE,
    abilityOptions: abilities,
    skills,
    toolProficiency: draft.toolProficiency.trim(),
    originFeat: draft.originFeat,
    equipment: [],
    startingGold: CUSTOM_BACKGROUND_GOLD,
  };
}

/**
 * Welche Klassen im Katalog keinen passenden Hintergrund finden.
 *
 * Das ist die Rechnung, die den Eigenbau überhaupt nötig macht. Sie steht
 * hier, damit die Oberfläche sie anzeigen kann, statt sie in einer Doku zu
 * verstecken — und damit ein Test sie festhält.
 */
export function classesWithoutMatchingBackground(
  classes: ReadonlyArray<{ key: string; name: string; primaryAbilities: AbilityKey[] }>,
  backgrounds: ReadonlyArray<{ abilityOptions: AbilityKey[] }>,
): Array<{ key: string; name: string }> {
  return classes
    .filter((entry) => {
      // Nur Klassen mit mindestens zwei Primärattributen können überhaupt
      // klemmen — bei einem einzigen deckt ihn irgendein Hintergrund ab.
      if (entry.primaryAbilities.length < 2) return false;
      return !backgrounds.some((background) =>
        entry.primaryAbilities.every((ability) => background.abilityOptions.includes(ability)),
      );
    })
    .map((entry) => ({ key: entry.key, name: entry.name }));
}
