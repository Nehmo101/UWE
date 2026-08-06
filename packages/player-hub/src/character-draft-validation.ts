/**
 * Der Entwurf, noch einmal von vorn — die serverseitige Prüfung.
 *
 * Der Browser hat dieselben Regeln schon laufen lassen; das zählt hier
 * nichts. Ein Entwurf kommt als JSON-Zeichenkette an, und wer sie selbst
 * schreibt, gibt sich sechs Fertigkeiten, vier Zaubertricks und STÄ 30.
 * Deshalb wird hier jeder Schlüssel gegen den Katalog aufgelöst, jede Anzahl
 * gegen die Klasse gezählt und am Ende `validateDraft` aus dem Regelpaket
 * noch einmal komplett gefahren.
 *
 * Die Prüfung steht bewusst neben dem Dienst und nicht in ihm: sie kennt
 * weder Prisma noch die Zugangsregeln, ist damit ohne Datenbank testbar —
 * und `player-characters.ts` bleibt das, was es sein soll, nämlich der Weg
 * von „darf der?" zur Transaktion.
 */

import {
  ABILITIES,
  collectSkillProficiencies,
  derivePreview,
  evaluatePointBuy,
  findAlignment,
  CUSTOM_BACKGROUND_KEY,
  originFeats,
  resolveBackground,
  type CustomBackgroundDraft,
  findClass,
  findFeat,
  findLanguage,
  findLineage,
  findSpecies,
  findSpell,
  findSubclass,
  SKILLS,
  spellsForClass,
  STANDARD_ARRAY,
  validateDraft,
  type AbilityKey,
  type AbilityMethod,
  type AbilityScoreMap,
  type Alignment,
  type Background,
  type CharacterDetails,
  type CharacterDraft,
  type DndClass,
  type EquipmentLine,
  type Language,
  type SkillKey,
  type Species,
  type SpeciesLineage,
  type Spell,
  type Subclass,
} from "@uwe/character-creator";

import {
  buildCharacterJsonColumns,
  type CharacterJsonColumns,
  type ResolvedCharacterCatalog,
} from "./character-json";

/**
 * Der Entwurf, wie er über die Leitung kommt.
 *
 * Absichtlich lockerer als `CharacterDraft`: aus einer JSON-Zeichenkette
 * kommen `string`, keine `SkillKey`. Die Verengung ist die Aufgabe der
 * Prüfung unten, nicht die eines `as`-Ausdrucks an der Route.
 * `CharacterDraft` ist auf diese Form zuweisbar, der Ersteller kann seinen
 * Entwurf also unverändert schicken.
 */
export interface CharacterDraftInput {
  name: string;
  speciesKey: string | null;
  lineageKey: string | null;
  classKey: string | null;
  subclassKey: string | null;
  backgroundKey: string | null;
  /** Der selbst gebaute Hintergrund, falls `backgroundKey` darauf zeigt. */
  customBackground: CustomBackgroundDraft | null;
  abilities: {
    method: AbilityMethod;
    base: AbilityScoreMap;
    backgroundBonus: Partial<Record<AbilityKey, number>>;
    rolled?: number[];
  } | null;
  chosenSkills: readonly string[];
  equipmentChoice: string | null;
  cantrips: readonly string[];
  spells: readonly string[];
  languages: readonly string[];
  alignmentKey: string | null;
  details: CharacterDetails;
}

export type CreateFullCharacterResult =
  | { ok: true; characterId: string; pageSlug: string }
  | { ok: false; error: string; issues: string[] };

/** Länge des Anzeigenamens — beide Anlege-Wege schneiden gleich ab. */
export const CHARACTER_NAME_MAX = 120;
/** Die Grenzen eines Attributwerts auf Stufe 1, bevor der Hintergrund draufzahlt. */
const BASE_SCORE_MIN = 3;
const BASE_SCORE_MAX = 18;

const SKILL_KEYS = new Set<string>(SKILLS);

/** Der geprüfte Entwurf mitsamt allem, was das Anlegen daraus braucht. */
export interface ValidatedDraft {
  draft: CharacterDraft;
  catalog: ResolvedCharacterCatalog;
  json: CharacterJsonColumns;
  skillProficiencies: SkillKey[];
  cantrips: Spell[];
  spells: Spell[];
  startingItems: StartingItem[];
  startingGold: number;
  scores: AbilityScoreMap;
  maxHp: number;
  armorClass: number;
  speed: number;
}

/** Eine Zeile Startausrüstung, fertig für `addItem`. */
export interface StartingItem {
  name: string;
  quantity: number;
  weight: number | null;
  valueCp: number | null;
  notes: string;
}

// ─────────────────────────── Serverseitige Prüfung ───────────────────────────

function checkAbilityScores(
  base: AbilityScoreMap,
  method: AbilityMethod,
  issues: string[],
): void {
  const values: number[] = [];
  for (const ability of ABILITIES) {
    const value = base[ability];
    if (!Number.isInteger(value) || value < BASE_SCORE_MIN || value > BASE_SCORE_MAX) {
      issues.push(`Attributswert außerhalb des erlaubten Bereichs: ${ability}.`);
      return;
    }
    values.push(value);
  }

  if (method === "standard_array") {
    const sorted = [...values].sort((a, b) => a - b).join(",");
    const expected = [...STANDARD_ARRAY].sort((a, b) => a - b).join(",");
    if (sorted !== expected) {
      issues.push("Die Standardwerte wurden verändert.");
    }
    return;
  }

  if (method === "point_buy" && !evaluatePointBuy(base).valid) {
    issues.push("Der Punktekauf überschreitet das Budget.");
  }
}

/**
 * Der Entwurf, noch einmal von vorn.
 *
 * Der Browser hat dieselbe Prüfung schon laufen lassen — das zählt hier
 * nichts. Ein Entwurf kommt als JSON-Zeichenkette an; wer sie selbst
 * schreibt, kann sich sechs Fertigkeiten, vier Zaubertricks und STÄ 30
 * geben. Deshalb wird jeder Schlüssel gegen den Katalog aufgelöst, jede
 * Anzahl gegen die Klasse gezählt und am Ende `validateDraft` aus dem
 * Regelpaket noch einmal komplett gefahren.
 */
export function validateFullDraft(
  input: CharacterDraftInput,
): { ok: true; value: ValidatedDraft } | { ok: false; issues: string[] } {
  const issues: string[] = [];

  const name = input.name.trim().slice(0, CHARACTER_NAME_MAX);
  if (!name) {
    issues.push("Der Charakter braucht einen Namen.");
  }

  const species: Species | null = input.speciesKey ? (findSpecies(input.speciesKey) ?? null) : null;
  if (!species) {
    issues.push("Unbekanntes Volk.");
  }

  let lineage: SpeciesLineage | null = null;
  if (species) {
    if (species.lineages?.length) {
      lineage = input.lineageKey ? (findLineage(species.key, input.lineageKey) ?? null) : null;
      if (!lineage) {
        issues.push(`Wähle eine ${species.lineageLabel ?? "Abstammung"}.`);
      }
    } else if (input.lineageKey) {
      issues.push("Dieses Volk kennt keine Abstammungen.");
    }
  }

  const dndClass: DndClass | null = input.classKey ? (findClass(input.classKey) ?? null) : null;
  if (!dndClass) {
    issues.push("Unbekannte Klasse.");
  }

  let subclass: Subclass | null = null;
  if (dndClass) {
    if (dndClass.subclassLevel <= 1) {
      subclass = input.subclassKey ? (findSubclass(dndClass.key, input.subclassKey) ?? null) : null;
      if (!subclass) {
        issues.push(`Wähle ${dndClass.subclassLabel}.`);
      }
    } else if (input.subclassKey) {
      issues.push(`${dndClass.subclassLabel} wird erst auf Stufe ${dndClass.subclassLevel} gewählt.`);
    }
  }

  /*
   * Der Hintergrund wird serverseitig neu aufgelöst — auch der selbst
   * gebaute. `buildCustomBackground` prüft den Bauplan erneut und gibt `null`
   * zurück, wenn er unvollständig ist; damit kann ein manipulierter Entwurf
   * sich keine vierte Fertigkeit oder ein fremdes Attributstripel erschleichen.
   */
  const background: Background | null = resolveBackground({
    backgroundKey: input.backgroundKey,
    customBackground: input.customBackground,
  });
  if (!background) {
    issues.push(
      input.backgroundKey === CUSTOM_BACKGROUND_KEY
        ? "Der eigene Hintergrund ist unvollständig."
        : "Unbekannter Hintergrund.",
    );
  }

  if (!input.abilities) {
    issues.push("Verteile deine Attributswerte.");
  } else {
    checkAbilityScores(input.abilities.base, input.abilities.method, issues);
  }

  // Fertigkeiten: bekannter Schlüssel, aus der Liste der Klasse, richtige Anzahl.
  const chosenSkills: SkillKey[] = [];
  for (const key of input.chosenSkills) {
    if (!SKILL_KEYS.has(key)) {
      issues.push(`Unbekannte Fertigkeit: ${key}.`);
      continue;
    }
    const skill = key as SkillKey;
    if (chosenSkills.includes(skill)) {
      issues.push("Eine Fertigkeit wurde doppelt gewählt.");
      continue;
    }
    if (dndClass && dndClass.skills.from.length > 0 && !dndClass.skills.from.includes(skill)) {
      issues.push(`${dndClass.name} kann diese Fertigkeit nicht wählen.`);
      continue;
    }
    chosenSkills.push(skill);
  }

  // Ausrüstung: entweder eine Option der Klasse oder die Goldvariante.
  let equipmentChoice: string | null = null;
  if (dndClass) {
    if (input.equipmentChoice === "gold") {
      if (dndClass.startingGoldAlternative === null) {
        issues.push(`${dndClass.name} bietet keine Goldvariante.`);
      } else {
        equipmentChoice = "gold";
      }
    } else if (input.equipmentChoice) {
      const option = dndClass.startingEquipment.find(
        (entry) => entry.key === input.equipmentChoice,
      );
      if (!option) {
        issues.push("Unbekannte Startausrüstung.");
      } else {
        equipmentChoice = option.key;
      }
    } else {
      issues.push("Wähle deine Startausrüstung.");
    }
  }

  // Zauber: nur aus der Liste der eigenen Klasse, und nur so viele wie erlaubt.
  const cantrips: Spell[] = [];
  const spells: Spell[] = [];
  if (dndClass) {
    const allowedCantrips = new Set(spellsForClass(dndClass.key, 0).map((entry) => entry.key));
    const allowedSpells = new Set(spellsForClass(dndClass.key, 1).map((entry) => entry.key));
    for (const key of input.cantrips) {
      const spell = findSpell(key);
      if (!spell || !allowedCantrips.has(key)) {
        issues.push(`Zaubertrick nicht auf der Liste von ${dndClass.name}: ${key}.`);
        continue;
      }
      cantrips.push(spell);
    }
    for (const key of input.spells) {
      const spell = findSpell(key);
      if (!spell || !allowedSpells.has(key)) {
        issues.push(`Zauber nicht auf der Liste von ${dndClass.name}: ${key}.`);
        continue;
      }
      spells.push(spell);
    }
  }

  const languages: Language[] = [];
  for (const key of input.languages) {
    const language = findLanguage(key);
    if (!language) {
      issues.push(`Unbekannte Sprache: ${key}.`);
      continue;
    }
    if (!languages.some((entry) => entry.key === language.key)) {
      languages.push(language);
    }
  }

  let alignment: Alignment | null = null;
  if (input.alignmentKey) {
    alignment = findAlignment(input.alignmentKey) ?? null;
    if (!alignment) {
      issues.push("Unbekannte Gesinnung.");
    }
  }

  if (!species || !dndClass || !background || !input.abilities || issues.length > 0) {
    return { ok: false, issues: dedupe(issues) };
  }

  const draft: CharacterDraft = {
    name,
    speciesKey: species.key,
    lineageKey: lineage?.key ?? null,
    classKey: dndClass.key,
    subclassKey: subclass?.key ?? null,
    backgroundKey: background.key,
    customBackground: input.customBackground ? { ...input.customBackground } : null,
    abilities: {
      method: input.abilities.method,
      base: { ...input.abilities.base },
      backgroundBonus: { ...input.abilities.backgroundBonus },
      ...(input.abilities.rolled ? { rolled: [...input.abilities.rolled] } : {}),
    },
    chosenSkills,
    equipmentChoice,
    cantrips: cantrips.map((entry) => entry.key),
    spells: spells.map((entry) => entry.key),
    languages: languages.map((entry) => entry.key),
    alignmentKey: alignment?.key ?? null,
    details: { ...input.details },
  };

  // Die kanonische Prüfung des Regelpakets — dieselbe, die der Browser fährt.
  // Sie deckt die Anzahlen (Fertigkeiten, Zauber) und die Hintergrund-Boni ab.
  const remaining = validateDraft({ draft, species, dndClass, background, originFeats: originFeats() })
    .filter((step) => !step.complete && !step.skipped)
    .flatMap((step) => step.issues);
  if (remaining.length > 0) {
    return { ok: false, issues: dedupe(remaining) };
  }

  const preview = derivePreview({ draft, species, lineage, dndClass, background });
  if (preview.hitPoints === null || preview.armorClass === null || preview.speed === null) {
    return { ok: false, issues: ["Die abgeleiteten Werte konnten nicht berechnet werden."] };
  }

  const originFeat = findFeat(background.originFeat) ?? null;
  const catalog: ResolvedCharacterCatalog = {
    species,
    lineage,
    dndClass,
    subclass,
    background,
    originFeat,
    alignment,
    languages,
  };

  const goldOnly = equipmentChoice === "gold";
  const option = goldOnly
    ? null
    : (dndClass.startingEquipment.find((entry) => entry.key === equipmentChoice) ?? null);

  return {
    ok: true,
    value: {
      draft,
      catalog,
      json: buildCharacterJsonColumns(catalog, draft.details, input.abilities.backgroundBonus),
      skillProficiencies: collectSkillProficiencies(chosenSkills, background),
      cantrips,
      spells,
      startingItems: collectStartingItems(option?.items ?? [], background),
      startingGold:
        (goldOnly ? (dndClass.startingGoldAlternative ?? 0) : (option?.gold ?? 0)) +
        background.startingGold,
      scores: preview.scores,
      maxHp: preview.hitPoints,
      armorClass: preview.armorClass,
      speed: preview.speed,
    },
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Klassenausrüstung und Hintergrundausrüstung in eine Liste.
 *
 * Der Hintergrund nennt seine Gegenstände nur als Klartextzeilen — mehr gibt
 * der SRD-Eintrag nicht her. Sie werden deshalb mit Menge 1 und ohne Gewicht
 * übernommen; die Notiz sagt, woher sie stammen, damit man sie am Tisch
 * auseinanderhalten kann.
 */
function collectStartingItems(lines: readonly EquipmentLine[], background: Background): StartingItem[] {
  const items: StartingItem[] = lines.map((line) => ({
    name: line.name,
    quantity: Math.max(1, Math.floor(line.quantity)),
    weight: line.weight ?? null,
    valueCp: line.valueCp ?? null,
    notes: line.notes ?? "Startausrüstung",
  }));

  for (const entry of background.equipment) {
    items.push({
      name: entry,
      quantity: 1,
      weight: null,
      valueCp: null,
      notes: `Hintergrund: ${background.name}`,
    });
  }

  return items;
}
