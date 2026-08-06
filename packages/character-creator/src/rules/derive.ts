/**
 * Aus dem Entwurf die Zahlen rechnen, die in der Vorschau-Leiste stehen.
 *
 * Der Ersteller zeigt permanent, was eine Entscheidung mit dem Charakter
 * macht — Trefferpunkte, Rüstungsklasse, Initiative, Rettungswürfe. Genau
 * das rechnet diese Datei. Sie kennt den Katalog nur über die Formen aus
 * `types.ts`; die konkreten Einträge werden hereingereicht, damit sich
 * Regeln und Inhalt unabhängig testen lassen.
 *
 * Wichtig: Das ist die **Stufe-1-Rechnung**. Alles, was mit Aufstieg zu tun
 * hat, gehört weiterhin in `character-level-up-service` — hier wird ein
 * Charakter geboren, nicht großgezogen.
 */

import {
  ABILITIES,
  type AbilityKey,
  type AbilityScoreMap,
  type Background,
  type CharacterDraft,
  type DndClass,
  type SkillKey,
  type Species,
  type SpeciesLineage,
} from "../types";
import { abilityModifier, modifierMap, totalScores } from "./abilities";

/** Was der Ersteller braucht, um zu rechnen — der aufgelöste Entwurf. */
export interface ResolvedDraft {
  draft: CharacterDraft;
  species: Species | null;
  lineage: SpeciesLineage | null;
  dndClass: DndClass | null;
  background: Background | null;
}

export interface DerivedPreview {
  /** Grundwerte plus Hintergrund-Bonus. */
  scores: AbilityScoreMap;
  modifiers: AbilityScoreMap;
  proficiencyBonus: number;
  hitPoints: number | null;
  hitDie: number | null;
  armorClass: number | null;
  initiative: number | null;
  speed: number | null;
  darkvision: number | null;
  /** Rettungswürfe, in denen die Klasse geübt ist. */
  savingThrows: AbilityKey[];
  /** Alle Fertigkeiten, in denen der Charakter geübt ist, ohne Duplikate. */
  skillProficiencies: SkillKey[];
  passivePerception: number | null;
  spellSaveDc: number | null;
  spellAttackBonus: number | null;
  spellcastingAbility: AbilityKey | null;
}

/** Auf Stufe 1 immer +2. Steht trotzdem hier, damit die Formel eine Heimat hat. */
export function proficiencyBonusForLevel(level: number): number {
  return Math.ceil(level / 4) + 1;
}

/**
 * Trefferpunkte auf Stufe 1: voller Trefferwürfel plus Konstitutionsmodifikator.
 * Nie unter 1 — ein Charakter mit KON 3 ist gebrechlich, nicht tot.
 */
export function startingHitPoints(hitDie: number, conModifier: number): number {
  return Math.max(1, hitDie + conModifier);
}

/**
 * Rüstungsklasse ohne Ausrüstung: 10 + Geschicklichkeit.
 *
 * Sobald die Startausrüstung Rüstung enthält, rechnet
 * `armorClassFromEquipment` darüber. Die Trennung ist Absicht: die Vorschau
 * soll schon vor dem Ausrüstungsschritt eine ehrliche Zahl zeigen.
 */
export function unarmoredArmorClass(dexModifier: number): number {
  return 10 + dexModifier;
}

/**
 * Rüstungsklasse aus einer Rüstungszeile.
 *
 * `notes` der Ausrüstung trägt die RK im Klartext ("RK 14 + GES (max 2)").
 * Das ist bewusst kein strukturiertes Feld: die Ausrüstungstabelle ist
 * Katalogtext, und ein halb strukturiertes Rüstungsmodell wäre ein
 * zweites, schlechteres Item-Modell neben `InventoryItem`. Wer die RK
 * automatisch will, gibt sie hier explizit an.
 */
export interface ArmorProfile {
  baseAc: number;
  dexCap: number | null;
  addsDex: boolean;
}

export function armorClassFromEquipment(
  armor: ArmorProfile | null,
  dexModifier: number,
  shieldBonus = 0,
): number {
  if (!armor) return unarmoredArmorClass(dexModifier) + shieldBonus;
  if (!armor.addsDex) return armor.baseAc + shieldBonus;
  const dex = armor.dexCap === null ? dexModifier : Math.min(dexModifier, armor.dexCap);
  return armor.baseAc + dex + shieldBonus;
}

/**
 * Der Hintergrund-Bonus als Zahlenkarte.
 *
 * SRD 2024: Der Hintergrund nennt drei Attribute; der Spieler verteilt
 * entweder +2/+1 oder +1/+1/+1. Was er gewählt hat, steht bereits in
 * `AbilityAllocation.backgroundBonus` — diese Funktion prüft nur, ob die
 * Verteilung zum Hintergrund passt.
 */
export function isBackgroundBonusValid(
  background: Background | null,
  bonus: Partial<Record<AbilityKey, number>>,
): boolean {
  if (!background) return false;

  const entries = ABILITIES.map((ability) => [ability, bonus[ability] ?? 0] as const).filter(
    ([, value]) => value > 0,
  );

  // Nur die drei erlaubten Attribute dürfen etwas bekommen.
  if (entries.some(([ability]) => !background.abilityOptions.includes(ability))) {
    return false;
  }

  const values = entries.map(([, value]) => value).sort((a, b) => b - a);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total !== 3) return false;

  const isTwoOne = values.length === 2 && values[0] === 2 && values[1] === 1;
  const isOneOneOne = values.length === 3 && values.every((value) => value === 1);
  return isTwoOne || isOneOneOne;
}

/** Alle Fertigkeiten des Charakters: Klasse (gewählt) + Hintergrund (fest). */
export function collectSkillProficiencies(
  chosen: readonly SkillKey[],
  background: Background | null,
): SkillKey[] {
  const all = new Set<SkillKey>(chosen);
  for (const skill of background?.skills ?? []) {
    all.add(skill);
  }
  return [...all];
}

/** Die vollständige Vorschau. Fehlende Entscheidungen ergeben `null`, nicht 0. */
export function derivePreview(resolved: ResolvedDraft): DerivedPreview {
  const { draft, species, lineage, dndClass, background } = resolved;

  const base = draft.abilities?.base ?? {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  };
  const scores = totalScores(base, draft.abilities?.backgroundBonus ?? {});
  const modifiers = modifierMap(scores);
  const proficiencyBonus = proficiencyBonusForLevel(1);

  const hitDie = dndClass?.hitDie ?? null;
  const hitPoints = hitDie === null ? null : startingHitPoints(hitDie, modifiers.constitution);

  const speed = lineage?.speed ?? species?.speed ?? null;
  const darkvision =
    lineage?.darkvision !== undefined ? lineage.darkvision : (species?.darkvision ?? null);

  const skillProficiencies = collectSkillProficiencies(draft.chosenSkills, background);

  const perceptionProficient = skillProficiencies.includes("perception");
  const passivePerception =
    draft.abilities === null
      ? null
      : 10 + modifiers.wisdom + (perceptionProficient ? proficiencyBonus : 0);

  const spellcastingAbility = dndClass?.spellcasting?.ability ?? null;
  const spellMod = spellcastingAbility ? modifiers[spellcastingAbility] : null;

  return {
    scores,
    modifiers,
    proficiencyBonus,
    hitPoints,
    hitDie,
    armorClass: draft.abilities === null ? null : unarmoredArmorClass(modifiers.dexterity),
    initiative: draft.abilities === null ? null : modifiers.dexterity,
    speed,
    darkvision,
    savingThrows: dndClass?.savingThrows ?? [],
    skillProficiencies,
    passivePerception,
    spellSaveDc: spellMod === null ? null : 8 + proficiencyBonus + spellMod,
    spellAttackBonus: spellMod === null ? null : proficiencyBonus + spellMod,
    spellcastingAbility,
  };
}

/** Modifikator eines einzelnen Attributs aus der Vorschau — Bequemlichkeit für die UI. */
export function previewModifier(preview: DerivedPreview, ability: AbilityKey): number {
  return abilityModifier(preview.scores[ability]);
}
