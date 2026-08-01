/**
 * Der UWE-Frontmatter-Dialekt.
 *
 * Lasse schreibt seine Wiki-Seiten seit je mit deutschen Schlüsseln:
 *
 *     titel: Pellar Hopsenried
 *     typ: nsc
 *     status: kanon
 *     kampagnen: [Turm, Himmelsrouten]
 *     siehe_auch: [ferlor, fluesterforst, xarza]
 *
 * Die bestehenden Importer kennen nur `title`/`type`/`tags` und werfen den Rest
 * **stumm** weg. Diese Tabelle ist die Übersetzung — und die englischen Namen
 * bleiben gültig, damit ältere Dateien und der KnoteForge-Export weiter laufen.
 *
 * Was hier nicht steht, geht nicht verloren: unbekannte Schlüssel landen in
 * `extra` und von dort in die Block-Metadaten und in eine Vorschau-Notiz.
 */

import type { DocFrontmatter } from "./types";
import {
  asList,
  asScalar,
  isUnsafeFrontmatterKey,
  normalizeFrontmatterKey,
  splitFrontmatter,
  type FrontmatterValue,
} from "./frontmatter";

type CanonicalKey =
  | "title"
  | "slug"
  | "type"
  | "summary"
  | "status"
  | "world"
  | "tags"
  | "aliases"
  | "campaigns"
  | "seeAlso"
  | "sources";

/**
 * Schlüssel sind bereits über `normalizeFrontmatterKey` normalisiert — `siehe_auch`,
 * `Siehe Auch` und `SIEHE-AUCH` kommen hier alle als `siehe-auch` an.
 */
const KEY_ALIASES: Record<string, CanonicalKey> = {
  // Titel
  titel: "title",
  title: "title",
  name: "title",
  ueberschrift: "title",

  // Slug
  slug: "slug",
  kennung: "slug",

  // Typ
  typ: "type",
  type: "type",
  art: "type",
  kategorie: "type",
  category: "type",

  // Zusammenfassung
  zusammenfassung: "summary",
  summary: "summary",
  kurzfassung: "summary",
  untertitel: "summary",

  // Kanon-Status
  status: "status",
  kanon: "status",
  kanonstatus: "status",
  "canonical-status": "status",

  // Welt (nur Abgleich)
  welt: "world",
  world: "world",

  // Listen
  tags: "tags",
  schlagworte: "tags",
  schlagwoerter: "tags",
  alias: "aliases",
  aliase: "aliases",
  aliasse: "aliases",
  aliases: "aliases",
  kampagne: "campaigns",
  kampagnen: "campaigns",
  campaign: "campaigns",
  campaigns: "campaigns",
  "siehe-auch": "seeAlso",
  "see-also": "seeAlso",
  verwandt: "seeAlso",
  related: "seeAlso",
  quelle: "sources",
  quellen: "sources",
  source: "sources",
  sources: "sources",
};

type ListKey = "tags" | "aliases" | "campaigns" | "seeAlso" | "sources";

const LIST_KEYS: ReadonlySet<CanonicalKey> = new Set<ListKey>([
  "tags",
  "aliases",
  "campaigns",
  "seeAlso",
  "sources",
]);

/** Alle Schlüssel, die der Dialekt versteht — für Hinweise in der Vorschau. */
export function knownFrontmatterKeys(): string[] {
  return Object.keys(KEY_ALIASES).sort();
}

/** Übersetzt einen rohen Frontmatter-Schlüssel, oder `null`, wenn er unbekannt ist. */
export function resolveFrontmatterKey(rawKey: string): CanonicalKey | null {
  return KEY_ALIASES[normalizeFrontmatterKey(rawKey)] ?? null;
}

function emptyFrontmatter(): DocFrontmatter {
  return {
    tags: [],
    aliases: [],
    campaigns: [],
    seeAlso: [],
    sources: [],
    extra: {},
  };
}

/** Wendet den Dialekt auf bereits zerlegte Frontmatter-Werte an. */
export function applyDialect(values: Record<string, FrontmatterValue>): DocFrontmatter {
  const result = emptyFrontmatter();

  for (const [rawKey, rawValue] of Object.entries(values)) {
    // Auch hier, nicht nur im Parser: `applyDialect` ist öffentlich und darf
    // nicht davon abhängen, dass die Werte durch `parseFrontmatterLines` kamen.
    if (isUnsafeFrontmatterKey(rawKey)) continue;

    const key = KEY_ALIASES[rawKey];

    if (!key) {
      // Unbekannt heißt „aufheben", nicht „wegwerfen".
      const flat = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;
      if (flat.trim()) result.extra[rawKey] = flat.trim();
      continue;
    }

    if (LIST_KEYS.has(key)) {
      const items = asList(rawValue);
      if (items.length > 0) {
        (result[key] as string[]).push(...items);
      }
      continue;
    }

    const scalar = asScalar(rawValue);
    if (scalar) {
      result[key as Exclude<CanonicalKey, ListKey>] = scalar;
    }
  }

  return result;
}

export interface ParsedDocument {
  frontmatter: DocFrontmatter;
  body: string;
  hadFrontmatter: boolean;
}

/**
 * Zerlegt ein Markdown-Dokument in Dialekt-Frontmatter und Rumpf.
 *
 * Ohne Frontmatter ist das Ergebnis leer, aber gültig — ein Dokument darf auch
 * einfach nur Text sein; Titel und Typ kommen dann aus Überschrift und Inhalt.
 */
export function parseDocument(markdown: string): ParsedDocument {
  const { values, body, present } = splitFrontmatter(markdown);
  return { frontmatter: applyDialect(values), body, hadFrontmatter: present };
}

/**
 * Baut die Warnungen, die in der Import-Vorschau erscheinen sollen. Sie sind
 * keine Fehler — der Import läuft — sondern der Hinweis, dass etwas nicht so
 * ankommt, wie es dasteht.
 */
export function frontmatterWarnings(
  frontmatter: DocFrontmatter,
  options: { worldName?: string; worldSlug?: string } = {},
): string[] {
  const warnings: string[] = [];

  const extraKeys = Object.keys(frontmatter.extra);
  if (extraKeys.length > 0) {
    warnings.push(
      `Unbekannte Frontmatter-Schlüssel bleiben als Metadaten erhalten: ${extraKeys.join(", ")}.`,
    );
  }

  const declaredWorld = frontmatter.world;
  if (declaredWorld && (options.worldName || options.worldSlug)) {
    const matches =
      normalizeFrontmatterKey(declaredWorld) === normalizeFrontmatterKey(options.worldName ?? "") ||
      normalizeFrontmatterKey(declaredWorld) === normalizeFrontmatterKey(options.worldSlug ?? "");
    if (!matches) {
      warnings.push(
        `Frontmatter nennt die Welt „${declaredWorld}", importiert wird nach „${options.worldName ?? options.worldSlug}".`,
      );
    }
  }

  return warnings;
}
