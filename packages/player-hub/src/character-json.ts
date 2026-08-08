/**
 * Die vier JSON-Spalten des Charakterbogens — endlich mit Form.
 *
 * `Character.species`, `.background`, `.features` und `.bio` sind seit der
 * ersten Migration `Json?` und waren bis hierher leer: der Studio-Bogen
 * schrieb sie nie, und `CreateCharacterInput` reicht sie als
 * `Prisma.InputJsonValue` durch, also ohne jede Zusage über den Inhalt. Wer
 * sie ohne Vertrag füllt, hat in einem halben Jahr vier verschiedene Formen
 * in derselben Spalte und keinen Weg zurück.
 *
 * Deshalb steht hier für jede der vier Spalten genau ein Interface, und jedes
 * trägt seine `schemaVersion`. Das ist die billigste Versicherung, die es
 * für eine schemalose Spalte gibt: ein Leser, der eine unbekannte Version
 * findet, weiß, dass er nicht raten darf.
 *
 * Grundsätze für alle vier:
 *
 *   1. **Schlüssel *und* Name.** Der Schlüssel verbindet mit dem Katalog, der
 *      Name überlebt es, wenn ein Katalogeintrag umbenannt wird oder
 *      verschwindet. Ein Bogen, der nach einem Katalog-Update seinen Volk
 *      nicht mehr anzeigen kann, ist kaputt.
 *   2. **Keine Zahlen, die woanders leben.** Trefferpunkte stehen in
 *      `combat`, Attribute in `abilities`, Fertigkeiten in `skills`. Hier
 *      steht nur, was sonst nirgends steht.
 *   3. **Reine Abbildung.** Dieses Modul kennt weder Prisma noch die
 *      Zugriffsregeln — es übersetzt Katalog in Spaltenform, sonst nichts.
 */

import { resolveSpeciesSize, findInvention } from "@uwe/character-creator";
import type {
  AbilityKey,
  Alignment,
  Background,
  CharacterDetails,
  ContentSource,
  CreatureSize,
  DndClass,
  Feat,
  Language,
  SkillKey,
  Species,
  SpeciesLineage,
  Subclass,
} from "@uwe/character-creator";

/** Alle vier Formen tragen dieselbe Version; sie werden gemeinsam geschrieben. */
export const CHARACTER_JSON_SCHEMA_VERSION = 1;

/** Ein Katalogverweis: Schlüssel zum Nachschlagen, Name zum Anzeigen. */
export interface CatalogReference {
  key: string;
  name: string;
}

// ─────────────────────────── Character.species ───────────────────────────

/** Was in `Character.species` steht: Volk, Abstammung und deren Kennzahlen. */
export interface CharacterSpeciesJson {
  schemaVersion: number;
  key: string;
  name: string;
  nameEn: string;
  size: CreatureSize;
  /** Bewegungsrate in Fuß — die der Abstammung schlägt die des Volkes. */
  speed: number;
  darkvision: number | null;
  /** Die gewählte Abstammung, `null` wenn das Volk keine kennt. */
  lineage: (CatalogReference & { nameEn: string }) | null;
  /** Wie die UI die Abstammung nennt („Elfenvolk", „Ahnenlinie"). */
  lineageLabel: string | null;
  source: ContentSource;
}

// ────────────────────────── Character.background ──────────────────────────

/** Was in `Character.background` steht: Herkunft, Ursprungstalent, Startbesitz. */
export interface CharacterBackgroundJson {
  schemaVersion: number;
  key: string;
  name: string;
  nameEn: string;
  /** Die beiden Fertigkeiten, die der Hintergrund fest mitbringt. */
  skills: SkillKey[];
  toolProficiency: string | null;
  /** Das Ursprungstalent — Verweis, der Regeltext steht in `features`. */
  originFeat: CatalogReference | null;
  /** Wie der Spieler die +2/+1 bzw. +1/+1/+1 des Hintergrunds verteilt hat. */
  abilityBonus: Partial<Record<AbilityKey, number>>;
  /** Startgold in Goldmünzen, wie der Katalog es nennt. */
  startingGold: number;
  source: ContentSource;
}

// ─────────────────────────── Character.features ───────────────────────────

export type CharacterFeatureOrigin =
  | "species"
  | "lineage"
  | "class"
  | "subclass"
  | "background"
  | "feat";

/** Ein einzelnes Merkmal mit seiner Herkunft. */
export interface CharacterFeatureEntry {
  name: string;
  description: string;
  /** Ab welcher Stufe es greift — auf Stufe 1 immer 1. */
  level: number;
  origin: CharacterFeatureOrigin;
  /** Wer es mitbringt: „Waldelf", „Waldläufer", „Zäher Kämpfer". */
  originName: string;
}

/**
 * Was in `Character.features` steht: alle Merkmale plus die Übungen, die
 * keine Fertigkeit sind (Rüstung, Waffen, Werkzeuge, Sprachen).
 *
 * Fertigkeiten stehen bewusst **nicht** hier — die haben mit
 * `Character.skills` eine eigene, ausgewertete Spalte
 * (`CharacterSkillProfile`), und zwei Wahrheiten über dieselbe Sache sind
 * eine zu viel.
 */
export interface CharacterFeaturesJson {
  schemaVersion: number;
  entries: CharacterFeatureEntry[];
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
  };
  languages: CatalogReference[];
}

// ───────────────────────────── Character.bio ─────────────────────────────

/** Was in `Character.bio` steht: alles, was der Beschreibungsschritt sammelt. */
export interface CharacterBioJson extends CharacterDetails {
  schemaVersion: number;
  alignment: CatalogReference | null;
}

// ─────────────────────────────── Der Bauer ───────────────────────────────

/** Der aufgelöste Katalog zu einem Entwurf — Eingabe aller vier Bauer. */
export interface ResolvedCharacterCatalog {
  species: Species;
  lineage: SpeciesLineage | null;
  dndClass: DndClass;
  subclass: Subclass | null;
  background: Background;
  originFeat: Feat | null;
  alignment: Alignment | null;
  languages: Language[];
}

export function buildSpeciesJson(
  species: Species,
  lineage: SpeciesLineage | null,
  sizeKey?: CreatureSize | null,
): CharacterSpeciesJson {
  return {
    schemaVersion: CHARACTER_JSON_SCHEMA_VERSION,
    key: species.key,
    name: species.name,
    nameEn: species.nameEn,
    size: resolveSpeciesSize(species, lineage, sizeKey) ?? species.size,
    speed: lineage?.speed ?? species.speed,
    // `lineage.darkvision` darf ausdrücklich `null` sein („diese Abstammung
    // sieht im Dunkeln nichts"), deshalb `undefined`-Prüfung statt `??`.
    darkvision: lineage?.darkvision !== undefined ? lineage.darkvision : species.darkvision,
    lineage: lineage ? { key: lineage.key, name: lineage.name, nameEn: lineage.nameEn } : null,
    lineageLabel: species.lineageLabel ?? null,
    source: species.source,
  };
}

export function buildBackgroundJson(
  background: Background,
  originFeat: Feat | null,
  abilityBonus: Partial<Record<AbilityKey, number>>,
): CharacterBackgroundJson {
  return {
    schemaVersion: CHARACTER_JSON_SCHEMA_VERSION,
    key: background.key,
    name: background.name,
    nameEn: background.nameEn,
    skills: [...background.skills],
    toolProficiency: background.toolProficiency,
    originFeat: originFeat
      ? { key: originFeat.key, name: originFeat.name }
      : { key: background.originFeat, name: background.originFeat },
    abilityBonus: { ...abilityBonus },
    startingGold: background.startingGold,
    source: background.source,
  };
}

export function buildFeaturesJson(
  catalog: ResolvedCharacterCatalog,
  inventionKey?: string | null,
): CharacterFeaturesJson {
  const entries: CharacterFeatureEntry[] = [];

  const push = (
    origin: CharacterFeatureOrigin,
    originName: string,
    traits: ReadonlyArray<{ name: string; description: string; level?: number }>,
  ) => {
    for (const trait of traits) {
      entries.push({
        name: trait.name,
        description: trait.description,
        level: trait.level ?? 1,
        origin,
        originName,
      });
    }
  };

  push("species", catalog.species.name, catalog.species.traits);
  if (catalog.lineage) {
    push("lineage", catalog.lineage.name, catalog.lineage.traits);
  }
  push("class", catalog.dndClass.name, catalog.dndClass.features);
  const invention = inventionKey ? findInvention(inventionKey) : null;
  if (invention) {
    entries.push({
      name: invention.name,
      description: invention.description,
      level: 1,
      origin: "class",
      originName: catalog.dndClass.name,
    });
  }
  if (catalog.subclass) {
    push("subclass", catalog.subclass.name, catalog.subclass.features);
  }
  if (catalog.originFeat) {
    push("feat", catalog.originFeat.name, catalog.originFeat.benefits);
  }

  const tools = [...catalog.dndClass.toolProficiencies];
  if (catalog.background.toolProficiency && !tools.includes(catalog.background.toolProficiency)) {
    tools.push(catalog.background.toolProficiency);
  }

  return {
    schemaVersion: CHARACTER_JSON_SCHEMA_VERSION,
    entries,
    proficiencies: {
      armor: [...catalog.dndClass.armorProficiencies],
      weapons: [...catalog.dndClass.weaponProficiencies],
      tools,
    },
    languages: catalog.languages.map((language) => ({
      key: language.key,
      name: language.name,
    })),
  };
}

export function buildBioJson(
  details: CharacterDetails,
  alignment: Alignment | null,
): CharacterBioJson {
  return {
    schemaVersion: CHARACTER_JSON_SCHEMA_VERSION,
    pronouns: details.pronouns,
    age: details.age,
    height: details.height,
    weight: details.weight,
    eyes: details.eyes,
    hair: details.hair,
    skin: details.skin,
    appearance: details.appearance,
    backstory: details.backstory,
    personality: details.personality,
    ideals: details.ideals,
    bonds: details.bonds,
    flaws: details.flaws,
    alignment: alignment ? { key: alignment.key, name: alignment.name } : null,
  };
}

/** Alle vier Spalten in einem Rutsch — so, wie sie geschrieben werden. */
export interface CharacterJsonColumns {
  species: CharacterSpeciesJson;
  background: CharacterBackgroundJson;
  features: CharacterFeaturesJson;
  bio: CharacterBioJson;
}

export function buildCharacterJsonColumns(
  catalog: ResolvedCharacterCatalog,
  details: CharacterDetails,
  abilityBonus: Partial<Record<AbilityKey, number>>,
  options?: { sizeKey?: CreatureSize | null; inventionKey?: string | null },
): CharacterJsonColumns {
  return {
    species: buildSpeciesJson(catalog.species, catalog.lineage, options?.sizeKey),
    background: buildBackgroundJson(catalog.background, catalog.originFeat, abilityBonus),
    features: buildFeaturesJson(catalog, options?.inventionKey),
    bio: buildBioJson(details, catalog.alignment),
  };
}
