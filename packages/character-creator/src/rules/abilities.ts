/**
 * Attributswerte erzeugen — die vier Wege des Spielerhandbuchs.
 *
 * Alles hier ist reine Rechnung ohne Zufallsquelle im Modulzustand: Würfeln
 * bekommt seinen Zufall hereingereicht (`rollAbilityScores(random)`), damit
 * Tests denselben Wurf zweimal bekommen und der Server dasselbe Ergebnis
 * nachrechnen kann wie der Browser.
 */

import { ABILITIES, type AbilityKey, type AbilityScoreMap } from "../types";

/** Die Standardwerte aus dem Spielerhandbuch, absteigend. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/** Punktekauf: Budget und Kostentabelle. */
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

/** Was ein einzelner Wert im Punktekauf kostet. Außerhalb 8–15: `null`. */
export function pointBuyCost(score: number): number | null {
  return POINT_BUY_COST[score] ?? null;
}

/** Was ein Schritt von `score` auf `score + 1` zusätzlich kostet. */
export function pointBuyStepCost(score: number): number | null {
  const from = pointBuyCost(score);
  const to = pointBuyCost(score + 1);
  if (from === null || to === null) return null;
  return to - from;
}

export interface PointBuyState {
  spent: number;
  remaining: number;
  valid: boolean;
  /** Welche Werte außerhalb 8–15 liegen — für die Fehlermeldung. */
  outOfRange: AbilityKey[];
}

export function evaluatePointBuy(scores: AbilityScoreMap): PointBuyState {
  let spent = 0;
  const outOfRange: AbilityKey[] = [];

  for (const ability of ABILITIES) {
    const cost = pointBuyCost(scores[ability]);
    if (cost === null) {
      outOfRange.push(ability);
      continue;
    }
    spent += cost;
  }

  return {
    spent,
    remaining: POINT_BUY_BUDGET - spent,
    valid: outOfRange.length === 0 && spent <= POINT_BUY_BUDGET,
    outOfRange,
  };
}

/** Darf dieser Wert im Punktekauf noch um eins steigen? */
export function canRaise(scores: AbilityScoreMap, ability: AbilityKey): boolean {
  const current = scores[ability];
  if (current >= POINT_BUY_MAX) return false;
  const step = pointBuyStepCost(current);
  if (step === null) return false;
  return evaluatePointBuy(scores).remaining >= step;
}

export function canLower(scores: AbilityScoreMap, ability: AbilityKey): boolean {
  return scores[ability] > POINT_BUY_MIN;
}

/** Der Startpunkt des Punktekaufs: alles auf 8, volles Budget übrig. */
export function pointBuyStart(): AbilityScoreMap {
  return {
    strength: 8,
    dexterity: 8,
    constitution: 8,
    intelligence: 8,
    wisdom: 8,
    charisma: 8,
  };
}

/** Ein einzelner 4W6-Wurf: vier Würfel, der kleinste fällt weg. */
export interface AbilityRoll {
  dice: [number, number, number, number];
  dropped: number;
  total: number;
}

export type RandomSource = () => number;

function rollDie(random: RandomSource): number {
  return Math.floor(random() * 6) + 1;
}

export function rollOnce(random: RandomSource): AbilityRoll {
  const dice: [number, number, number, number] = [
    rollDie(random),
    rollDie(random),
    rollDie(random),
    rollDie(random),
  ];
  const lowest = Math.min(...dice);
  const total = dice.reduce((sum, die) => sum + die, 0) - lowest;
  return { dice, dropped: lowest, total };
}

/** Sechs Würfe, in Wurfreihenfolge — die Zuordnung macht der Spieler. */
export function rollAbilityScores(random: RandomSource): AbilityRoll[] {
  return Array.from({ length: 6 }, () => rollOnce(random));
}

/**
 * Verteilt eine Werteliste auf die Attribute.
 *
 * `assignment` bildet Attribut → Index in `pool` ab. Nicht zugewiesene
 * Attribute bekommen den Mindestwert, damit die Vorschau nie mit `NaN`
 * rechnet, solange der Spieler noch zuordnet.
 */
export function applyPool(
  pool: readonly number[],
  assignment: Partial<Record<AbilityKey, number>>,
  fallback = 8,
): AbilityScoreMap {
  const result = {} as AbilityScoreMap;
  for (const ability of ABILITIES) {
    const index = assignment[ability];
    const value = index === undefined ? undefined : pool[index];
    result[ability] = typeof value === "number" ? value : fallback;
  }
  return result;
}

/** Ist jeder Poolwert genau einmal vergeben? */
export function isPoolFullyAssigned(
  pool: readonly number[],
  assignment: Partial<Record<AbilityKey, number>>,
): boolean {
  const used = ABILITIES.map((ability) => assignment[ability]).filter(
    (index): index is number => typeof index === "number",
  );
  if (used.length !== pool.length) return false;
  return new Set(used).size === pool.length;
}

/** Der Modifikator zu einem Wert — dieselbe Formel wie im Bogen. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** `+3` / `-1` / `+0` — die Schreibweise, die überall in der UI steht. */
export function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

/** Grundwerte plus Hintergrund-Bonus, gedeckelt bei 20 wie auf Stufe 1 üblich. */
export function totalScores(
  base: AbilityScoreMap,
  bonus: Partial<Record<AbilityKey, number>>,
): AbilityScoreMap {
  const result = {} as AbilityScoreMap;
  for (const ability of ABILITIES) {
    result[ability] = Math.min(20, base[ability] + (bonus[ability] ?? 0));
  }
  return result;
}

export function modifierMap(scores: AbilityScoreMap): AbilityScoreMap {
  const result = {} as AbilityScoreMap;
  for (const ability of ABILITIES) {
    result[ability] = abilityModifier(scores[ability]);
  }
  return result;
}

/** Deutsche Beschriftungen — eine Quelle für alle Schritte. */
export const ABILITY_LABELS: Record<AbilityKey, string> = {
  strength: "Stärke",
  dexterity: "Geschicklichkeit",
  constitution: "Konstitution",
  intelligence: "Intelligenz",
  wisdom: "Weisheit",
  charisma: "Charisma",
};

/** Dreibuchstabige Kürzel für enge Stellen (Vorschau-Leiste, Chips). */
export const ABILITY_SHORT: Record<AbilityKey, string> = {
  strength: "STÄ",
  dexterity: "GES",
  constitution: "KON",
  intelligence: "INT",
  wisdom: "WEI",
  charisma: "CHA",
};

/**
 * Was das Attribut am Tisch tut — ein Halbsatz, der einem neuen Spieler die
 * Verteilung abnimmt. Steht als Hilfetext unter jedem Wert.
 */
export const ABILITY_HINTS: Record<AbilityKey, string> = {
  strength: "Zuschlagen, heben, klettern, Türen eintreten.",
  dexterity: "Zielen, ausweichen, schleichen, Initiative.",
  constitution: "Trefferpunkte und alles, was man aushalten muss.",
  intelligence: "Wissen, Nachforschen, arkane Magie.",
  wisdom: "Wahrnehmen, Menschen lesen, göttliche Magie.",
  charisma: "Überzeugen, auftreten, Pakt- und Blutmagie.",
};
