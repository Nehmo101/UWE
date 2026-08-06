/**
 * Die Zauber des 1. Grades an einer Stelle.
 *
 * Der Inhalt liegt in zwei Hälften (`spells-level1-a-f`, `spells-level1-g-z`),
 * weil eine einzelne Datei die Zeilengrenze reißen würde. Diese Datei ist die
 * Adresse, die der Rest des Programms kennt — und die einzige Stelle, an der
 * Zaubertricks und Zauber des 1. Grades zusammen nachgeschlagen werden.
 */

import type { Spell } from "../types";

import { CANTRIPS } from "./spells-cantrips";
import { LEVEL1_SPELLS_A_F } from "./spells-level1-a-f";
import { LEVEL1_SPELLS_G_Z } from "./spells-level1-g-z";

/** Alle 57 Zauber des 1. Grades aus dem SRD 5.2.1. */
export const LEVEL1_SPELLS: Spell[] = [...LEVEL1_SPELLS_A_F, ...LEVEL1_SPELLS_G_Z];

/**
 * Nachschlagen per Zauberschlüssel — über beide Grade hinweg.
 *
 * Ein Charakter der Stufe 1 hält Zaubertricks und Zauber des 1. Grades in zwei
 * getrennten Listen des Entwurfs; wer einen Schlüssel aus dem gespeicherten
 * Entwurf auflöst, weiß aber nicht mehr, aus welcher der beiden er stammt.
 * Deshalb sucht diese Funktion in beiden.
 */
export function findSpell(key: string): Spell | undefined {
  return CANTRIPS.find((spell) => spell.key === key) ?? LEVEL1_SPELLS.find((spell) => spell.key === key);
}
