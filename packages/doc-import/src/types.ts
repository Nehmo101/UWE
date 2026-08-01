import type { CanonicalStatus, PageType } from "@uwe/database/server";

/**
 * Ein Frontmatter-Block, nachdem der deutsche Dialekt aufgelöst wurde.
 *
 * `extra` ist bewusst Teil des Vertrags: Schlüssel, die der Dialekt nicht kennt,
 * werden **nicht** verworfen, sondern wandern in die Block-Metadaten und in eine
 * Vorschau-Notiz. Ein Tippfehler in `siehe_auch` soll auffallen, nicht schweigen.
 */
export interface DocFrontmatter {
  title?: string;
  slug?: string;
  /** Rohwert aus `typ:`/`type:` — die Auflösung auf `PageType` macht `resolvePageType`. */
  type?: string;
  summary?: string;
  /** Rohwert aus `status:` — Auflösung über `resolveCanonicalStatus`. */
  status?: string;
  /** Rohwert aus `welt:` — dient nur dem Abgleich mit der gewählten Zielwelt. */
  world?: string;
  tags: string[];
  aliases: string[];
  campaigns: string[];
  seeAlso: string[];
  sources: string[];
  extra: Record<string, string>;
}

/** Marker aus dem Weltkanon: ◆ = festgelegter Kanon, ◇ = Vorschlag. */
export type CanonMarker = "canon" | "proposal";

/** Ein Abschnitt des Dokuments, aufgespannt an seiner Überschrift. */
export interface DocumentNode {
  /** Überschriftenebene 1–6. */
  level: number;
  /** Überschriftentext, ohne `#` und ohne ◆/◇-Marker. */
  title: string;
  /** Markdown dieses Abschnitts **ohne** die Überschriftenzeile. */
  body: string;
  /** Im Titel gefundener Kanon-Marker, falls vorhanden. */
  marker: CanonMarker | null;
  /** Position unter den Geschwistern, ab 0. */
  sortIndex: number;
  children: DocumentNode[];
}

export interface DocumentTree {
  /** Text vor der ersten Überschrift (Untertitel, Vorspann). */
  preamble: string;
  nodes: DocumentNode[];
}

/**
 * Typ-Profil eines Dokuments. Bestimmt, welcher `PageType` aus einer Überschrift
 * wird — ein „Szene 1"-Abschnitt ist in einem Kampagnenbuch eine Begegnung, im
 * Weltkanon wäre dieselbe Zeile Lore.
 */
export type DocProfile = "campaign_book" | "dungeon" | "canon" | "plain";

/** Eine geplante Seite, bevor sie die Datenbank sieht. */
export interface PageDraft {
  /** Stabiler Schlüssel innerhalb eines Imports, für Eltern- und Kantenauflösung. */
  key: string;
  parentKey: string | null;
  sortIndex: number | null;
  title: string;
  slug: string;
  type: PageType;
  summary: string | null;
  canonicalStatus: CanonicalStatus | null;
  tags: string[];
  aliases: string[];
  /** Fertiges, noch nicht sanitisiertes HTML. Wikilinks stehen weiterhin als `[[…]]` darin. */
  html: string;
  /** Kampagnennamen aus dem Frontmatter, unaufgelöst (Reihenfolge = Vorrang). */
  campaigns: string[];
  /** Lookup-Ziele aus `siehe_auch`, unaufgelöst. */
  seeAlso: string[];
  metadata: Record<string, unknown>;
  warnings: string[];
}

/** Eine geplante `PageLink`-Kante, deren Ziel noch aufgelöst werden muss. */
export interface RelationDraft {
  sourceKey: string;
  /** Titel, Slug oder Alias der Zielseite. */
  targetLookup: string;
  relationType: string;
  label: string | null;
}
