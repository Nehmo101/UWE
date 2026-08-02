import type { CanonicalStatus, PageType } from "@uwe/database/server";

export type { PageType };

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
  /**
   * Rolle im Dokument, vergeben vom semantischen Umbau (`restructureDocument`).
   * Fehlt sie, ist der Knoten roh aus `buildDocumentTree` — dann entscheiden
   * allein die Titelmuster des Profils über den Seitentyp.
   */
  role?: SectionRole;
  /** Vom Umbau gesetzter Seitentyp. Schlägt die Titelmuster des Profils. */
  typeHint?: PageType;
  /**
   * Zusätzliche Suchnamen dieses Abschnitts — vor allem die Gliederungsnummer
   * (`C.1.3`, `F.2`), unter der das Dokument selbst auf ihn verweist.
   */
  aliases?: string[];
  /** Nicht aus einer Überschrift entstanden, sondern aus dem Rumpf herausgelöst. */
  synthetic?: boolean;
}

/**
 * Wofür ein Abschnitt im Dokument steht.
 *
 * Das ist die eigentliche Antwort auf „nicht jede Überschrift ist eine Seite":
 * Erst die Rolle entscheidet, ob aus einem Abschnitt eine Wiki-Seite wird
 * (`Ebene`, `Raum`, `NSC`, `Begegnung`, `Handout` …), ob er nur den Rumpf der
 * Seite darüber füllt (`abschnitt`, `detail`) oder ob er sich in seine Kinder
 * auflöst (`raumliste`, `werteblockliste`).
 */
export type SectionRole =
  /** Das Dokument selbst. */
  | "volume"
  /** Gliederungsteil ohne eigenen Gegenstand („TEIL A — FÜR DIE SPIELLEITUNG"). */
  | "part"
  | "level"
  | "room"
  | "npc"
  | "location"
  | "faction"
  | "item"
  | "quest"
  | "encounter"
  | "trap"
  | "puzzle"
  | "loot"
  | "secret"
  | "handout"
  | "statblock"
  /** Die abgetrennten Regelwerte einer Kreatur — Unterseite, DM-Bereich. */
  | "statblock_values"
  | "rule"
  | "dungeon"
  /** Abschnitt, dessen Aufzählungen Räume sind. */
  | "room_list"
  | "handout_list"
  | "statblock_list"
  | "npc_list"
  /** Eigenständiger Abschnitt ohne Sonderrolle — wird Rumpftext. */
  | "section"
  /** Kleinteiliges Beiwerk („Was man hier lernt") — wird Rumpftext. */
  | "detail";

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
