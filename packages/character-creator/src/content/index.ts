/**
 * Der Katalog an einer Stelle.
 *
 * Die Inhaltsdateien sind nach Umfang geschnitten, nicht nach Bedeutung —
 * zwölf Klassen passen nicht in eine Datei, die unter der Zeilengrenze
 * bleibt. Dieses Modul setzt sie wieder zusammen, damit der Rest des
 * Programms nur `CLASSES` kennt und nicht die Aufteilung.
 */

import type {
  Alignment,
  Background,
  DndClass,
  EquipmentPack,
  Feat,
  Language,
  Species,
  Spell,
} from "../types";

import { SPECIES } from "./species";
import { CLASSES_BARBARIAN_BARD_CLERIC } from "./classes-barbarian-bard-cleric";
import { CLASSES_BLUTJAEGER } from "./classes-blutjaeger";
import { CLASSES_DRUID_FIGHTER_MONK } from "./classes-druid-fighter-monk";
import { CLASSES_ERFINDER } from "./classes-erfinder";
import { INVENTIONS_ERFINDER, inventionsForLevel } from "./inventions-erfinder";
import { CLASSES_PALADIN_RANGER_ROGUE } from "./classes-paladin-ranger-rogue";
import { CLASSES_SORCERER_WARLOCK_WIZARD } from "./classes-sorcerer-warlock-wizard";
import { BACKGROUNDS } from "./backgrounds";
import { FEATS } from "./feats";
import { ALIGNMENTS, LANGUAGES } from "./misc";
import { ARMOR, EQUIPMENT_PACKS, WEAPONS } from "./equipment";
import { CANTRIPS } from "./spells-cantrips";
import { LEVEL1_SPELLS } from "./spells-level1";
import { LEVEL2_SPELLS } from "./spells-level2";
import { LEVEL3_SPELLS } from "./spells-level3";
import { LEVEL4_SPELLS } from "./spells-level4";
import { LEVEL5_SPELLS } from "./spells-level5";
import { LEVEL6_SPELLS } from "./spells-level6";
import { LEVEL7_SPELLS } from "./spells-level7";
import { LEVEL8_SPELLS } from "./spells-level8";
import { LEVEL9_SPELLS } from "./spells-level9";
import {
  buildCustomBackground,
  CUSTOM_BACKGROUND_KEY,
  type CustomBackgroundInput,
} from "../rules/custom-background";

export const CLASSES: DndClass[] = [
  ...CLASSES_BARBARIAN_BARD_CLERIC,
  ...CLASSES_BLUTJAEGER,
  ...CLASSES_DRUID_FIGHTER_MONK,
  ...CLASSES_ERFINDER,
  ...CLASSES_PALADIN_RANGER_ROGUE,
  ...CLASSES_SORCERER_WARLOCK_WIZARD,
];

/** Zaubertricks und Zauber Grad 1–9 (SRD). */
export const SPELLS: Spell[] = [
  ...CANTRIPS,
  ...LEVEL1_SPELLS,
  ...LEVEL2_SPELLS,
  ...LEVEL3_SPELLS,
  ...LEVEL4_SPELLS,
  ...LEVEL5_SPELLS,
  ...LEVEL6_SPELLS,
  ...LEVEL7_SPELLS,
  ...LEVEL8_SPELLS,
  ...LEVEL9_SPELLS,
];

export { SPECIES, BACKGROUNDS, FEATS, LANGUAGES, ALIGNMENTS };
export { EQUIPMENT_PACKS, WEAPONS, ARMOR };
export { INVENTIONS_ERFINDER, inventionsForLevel };
export {
  CANTRIPS,
  LEVEL1_SPELLS,
  LEVEL2_SPELLS,
  LEVEL3_SPELLS,
  LEVEL4_SPELLS,
  LEVEL5_SPELLS,
  LEVEL6_SPELLS,
  LEVEL7_SPELLS,
  LEVEL8_SPELLS,
  LEVEL9_SPELLS,
};

/**
 * Nachschlagen per Schlüssel.
 *
 * Bewusst als Funktionen und nicht als vorberechnete Maps: der Katalog ist
 * klein genug, dass ein `find` nicht auffällt, und eine Map müsste bei jedem
 * neuen Inhaltsmodul mitgepflegt werden.
 */
export function findSpecies(key: string): Species | undefined {
  return SPECIES.find((entry) => entry.key === key);
}

export function findClass(key: string): DndClass | undefined {
  return CLASSES.find((entry) => entry.key === key);
}

export function findBackground(key: string): Background | undefined {
  return BACKGROUNDS.find((entry) => entry.key === key);
}

/** Die Talente, die ein Hintergrund vergeben darf. */
export function originFeats(): Feat[] {
  return FEATS.filter((entry) => entry.category === "origin");
}

/**
 * Der Hintergrund eines Entwurfs — aus dem Katalog oder selbst gebaut.
 *
 * Die einzige Stelle, die den Unterschied kennt. Alles dahinter — Vorschau,
 * Prüfung, Anlegen — bekommt einen ganz normalen `Background` und muss nicht
 * wissen, woher er kommt.
 */
export function resolveBackground(draft: {
  backgroundKey: string | null;
  customBackground: CustomBackgroundInput | null;
}): Background | null {
  if (!draft.backgroundKey) return null;
  if (draft.backgroundKey === CUSTOM_BACKGROUND_KEY) {
    return buildCustomBackground(draft.customBackground, originFeats());
  }
  return findBackground(draft.backgroundKey) ?? null;
}

export function findFeat(key: string): Feat | undefined {
  return FEATS.find((entry) => entry.key === key);
}

export function findSpell(key: string): Spell | undefined {
  return SPELLS.find((entry) => entry.key === key);
}

export function findPack(key: string): EquipmentPack | undefined {
  return EQUIPMENT_PACKS.find((entry) => entry.key === key);
}

export function findLanguage(key: string): Language | undefined {
  return LANGUAGES.find((entry) => entry.key === key);
}

export function findAlignment(key: string): Alignment | undefined {
  return ALIGNMENTS.find((entry) => entry.key === key);
}

/** Die Abstammung innerhalb einer Spezies. */
export function findLineage(speciesKey: string, lineageKey: string) {
  return findSpecies(speciesKey)?.lineages?.find((entry) => entry.key === lineageKey);
}

/** Die Unterklasse innerhalb einer Klasse. */
export function findSubclass(classKey: string, subclassKey: string) {
  return findClass(classKey)?.subclasses.find((entry) => entry.key === subclassKey);
}

export function findInvention(key: string) {
  return INVENTIONS_ERFINDER.find((entry) => entry.key === key);
}

/** Alle Zauber, die diese Klasse auf der genannten Stufe wählen darf. */
export function spellsForClass(classKey: string, level: number): Spell[] {
  return SPELLS.filter((spell) => spell.level === level && spell.lists.includes(classKey));
}
