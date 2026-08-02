/**
 * Die Gliederung als flache Liste — die gemeinsame Sprache von Regeln und KI.
 *
 * Ein Hinweis der KI muss auf **denselben** Abschnitt zeigen wie beim nächsten
 * Durchlauf, sonst geht er ins Leere. Deshalb ist der Pfad hier an die
 * **Rohüberschriften** gebunden, nicht an die aufgeräumten Seitentitel: Was der
 * Umbau später mit dem Titel macht (Nummer abtrennen, Großschreibung
 * zurücknehmen, redaktionelle Klammern streichen), darf den Schlüssel nicht
 * verschieben.
 */

import type { SectionRole } from "../types";

export interface OutlineEntry {
  /** `FÜR DIE SPIELLEITUNG › Die vier Haken — FTKJ persönlich`. */
  path: string;
  title: string;
  /** Erste Zeilen des Abschnitts — genug zum Einordnen, wenig genug für die Lane. */
  excerpt: string;
  /** Was die Regeln vergeben haben. */
  role: SectionRole;
}

const EXCERPT_LENGTH = 400;

/** Pfad eines Knotens: `TEIL C › EBENE 1 › Die Räume`. */
export function nodePath(trail: string[]): string {
  return trail.join(" › ");
}

/** Anreißer eines Abschnitts, von Markdown befreit. */
export function outlineExcerpt(body: string): string {
  const flat = body
    .replace(/^>\s?/gm, "")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH)}…` : flat;
}
