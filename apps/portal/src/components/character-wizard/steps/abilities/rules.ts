"use client";

/**
 * Der rechnende und beschreibende Teil des Attributsschritts.
 *
 * Hier steht nichts, was rendert — nur Konstanten und reine Funktionen. Das
 * ist kein Ordnungsfimmel: Die Zuordnung von Poolwerten zu Attributen
 * (`deriveAssignment`) ist die einzige Stelle im Schritt, die man wirklich
 * falsch bauen kann, und sie soll ohne React lesbar sein.
 *
 * Die eigentliche Regelmathematik liegt weiterhin in
 * `@uwe/character-creator/rules/abilities` — von hier wird sie benutzt, nicht
 * nachgebaut.
 */

import {
  ABILITIES,
  ABILITY_LABELS,
  STANDARD_ARRAY,
  type AbilityAllocation,
  type AbilityKey,
  type AbilityMethod,
  type AbilityRoll,
  type AbilityScoreMap,
  type DndClass,
} from "@uwe/character-creator";

import type { ResolvedCatalog } from "../../types";

export const METHODS: ReadonlyArray<{
  key: AbilityMethod;
  name: string;
  hook: string;
  meta: string;
  icon: string;
}> = [
  {
    key: "standard_array",
    name: "Standardwerte",
    hook: "Sechs feste Zahlen aus dem Regelwerk. Du entscheidest nur, welche Zahl auf welches Attribut geht — kein Zufall, keine Rechnerei.",
    meta: "15 · 14 · 13 · 12 · 10 · 8",
    icon: "list-ordered",
  },
  {
    key: "point_buy",
    name: "Punktekauf",
    hook: "27 Punkte zum Verteilen. Hohe Werte kosten überproportional, deshalb ist jede 15 anderswo eine 10.",
    meta: "27 Punkte",
    icon: "coins",
  },
  {
    key: "roll",
    name: "Würfeln",
    hook: "Sechsmal 4W6, der kleinste Würfel fällt jedes Mal weg. Kann großartig laufen und kann danebengehen — das ist der Reiz.",
    meta: "4W6, kleinsten streichen",
    icon: "dices",
  },
  {
    key: "manual",
    name: "Manuell",
    hook: "Werte direkt eintragen. Für Charaktere aus einer anderen Runde oder für Vorgaben der Spielleitung.",
    meta: "1 bis 20",
    icon: "pencil",
  },
];

/** Startpunkt für „Manuell": die Mitte, damit niemand bei 8 anfangen muss. */
export const MANUAL_START: AbilityScoreMap = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

/**
 * Darf sich etwas bewegen? Dieselben zwei Quellen wie `useSceneMotion`: die
 * Systemvorliebe und der App-Schalter auf `<html>`. Wird erst im Klick
 * gelesen — im ersten Frame gibt es weder Fenster noch Wurf.
 */
export function motionDisabled(): boolean {
  if (typeof window === "undefined") return true;
  if (document.documentElement.getAttribute("data-uwe-motion") === "off") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Die Werteliste, aus der gerade verteilt wird. Punktekauf und Manuell haben keine. */
export function poolFor(allocation: AbilityAllocation | null): readonly number[] {
  if (allocation?.method === "standard_array") return STANDARD_ARRAY;
  if (allocation?.method === "roll") return allocation.rolled ?? [];
  return [];
}

/** Attribut → Poolplatz, in Poolreihenfolge. Der Startzustand jeder Verteilung. */
export function orderedAssignment(pool: readonly number[]): Partial<Record<AbilityKey, number>> {
  const result: Partial<Record<AbilityKey, number>> = {};
  ABILITIES.forEach((ability, index) => {
    if (index < pool.length) result[ability] = index;
  });
  return result;
}

/**
 * Rechnet aus den Grundwerten zurück, welcher Poolplatz auf welchem Attribut
 * liegt.
 *
 * Damit braucht der Schritt keinen lokalen Spiegel des Entwurfs: Die
 * Verteilung ist immer vollständig (sie startet vollständig und wird nur
 * getauscht), also lässt sie sich eindeutig genug zurücklesen. Gleiche Zahlen
 * im Pool sind austauschbar — welcher der beiden Dreizehner wo liegt, ist ohne
 * Bedeutung, solange jeder genau einmal zählt.
 */
export function deriveAssignment(
  pool: readonly number[],
  base: AbilityScoreMap | null,
): Partial<Record<AbilityKey, number>> {
  if (!base || pool.length === 0) return {};
  const taken = new Set<number>();
  const result: Partial<Record<AbilityKey, number>> = {};
  for (const ability of ABILITIES) {
    const index = pool.findIndex((value, at) => !taken.has(at) && value === base[ability]);
    if (index >= 0) {
      taken.add(index);
      result[ability] = index;
    }
  }
  return result;
}

/** Wohin die höchsten Werte gehören, wenn man der Klasse folgt. */
export function recommendedOrder(dndClass: DndClass | null): AbilityKey[] {
  const order: AbilityKey[] = [];
  const push = (ability: AbilityKey) => {
    if (!order.includes(ability)) order.push(ability);
  };
  for (const ability of dndClass?.primaryAbilities ?? []) push(ability);
  if (dndClass?.spellcasting) push(dndClass.spellcasting.ability);
  // Konstitution steht vor den Rettungswürfen: Trefferpunkte braucht jeder.
  push("constitution");
  for (const ability of dndClass?.savingThrows ?? []) push(ability);
  for (const ability of ABILITIES) push(ability);
  return order;
}

export interface Relevance {
  label: string;
  title: string;
  accent: boolean;
}

/**
 * Wer sich für dieses Attribut interessiert — Klasse, Hintergrund, Volk.
 *
 * Die Marken sind bewusst kurz gehalten (höchstens vierzehn Zeichen): Sie
 * stehen in der schmalsten Spalte der Zeile, und ein Chip mit `white-space:
 * nowrap` kann eine 390-px-Ansicht sonst waagerecht aufreißen. Der ganze Satz
 * steht im `title`.
 */
export function relevanceFor(ability: AbilityKey, resolved: ResolvedCatalog): Relevance[] {
  const marks: Relevance[] = [];
  const { dndClass, background, species, lineage } = resolved;

  if (dndClass?.primaryAbilities.includes(ability)) {
    marks.push({
      label: "Hauptattribut",
      title: `${dndClass.name}: Hauptattribut — davon hängen Angriffe und Klassenmerkmale ab.`,
      accent: true,
    });
  }
  if (dndClass?.spellcasting?.ability === ability) {
    marks.push({
      label: "Zauberattribut",
      title: `${dndClass.name}: Schwierigkeitsgrad und Angriffsbonus deiner Zauber.`,
      accent: true,
    });
  }
  if (dndClass?.savingThrows.includes(ability)) {
    marks.push({
      label: "Rettungswurf",
      title: `${dndClass.name}: geübt in Rettungswürfen auf ${ABILITY_LABELS[ability]}.`,
      accent: false,
    });
  }
  if (background?.abilityOptions.includes(ability)) {
    marks.push({
      label: "Hintergrund",
      title: `${background.name} darf ${ABILITY_LABELS[ability]} anheben.`,
      accent: false,
    });
  }

  // Das Volk vergibt nach den Regeln von 2024 keine Attributspunkte mehr —
  // seine Merkmale hängen aber sehr wohl an einzelnen Attributen. Gesucht wird
  // deshalb im Merkmalstext nach dem Attributsnamen („Konstitutionsmodifikator",
  // „Stärkewürfe"), statt eine zweite Tabelle zu erfinden, die veraltet.
  const traits = [...(species?.traits ?? []), ...(lineage?.traits ?? [])];
  const hit = traits.find(
    (trait) =>
      trait.name.includes(ABILITY_LABELS[ability]) ||
      trait.description.includes(ABILITY_LABELS[ability]),
  );
  if (hit) {
    marks.push({
      label: "Volksmerkmal",
      title: `${lineage?.name ?? species?.name ?? "Dein Volk"}: „${hit.name}" hängt an ${ABILITY_LABELS[ability]}.`,
      accent: false,
    });
  }

  return marks;
}

/** Der Wurf als Satz — die Würfel selbst sind für Vorleseprogramme unsichtbar. */
export function describeRoll(roll: AbilityRoll, index: number): string {
  return (
    `Wurf ${index + 1}: ${roll.dice.join(", ")} — ` +
    `die niedrigste ${roll.dropped} fällt weg, Ergebnis ${roll.total}.`
  );
}
