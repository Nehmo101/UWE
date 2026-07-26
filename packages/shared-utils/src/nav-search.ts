/**
 * Bereichs-Suche über den zentralen Navigations-Kontrakt.
 *
 * Rein logisch und framework-agnostisch, damit die Rangfolge direkt
 * unit-getestet werden kann. Konsument ist die Suchleiste `NavSearch`
 * (`@uwe/shared-ui`), die in Studio, Portal und Brain oben in der Topbar sitzt
 * und aus der jeweiligen Navigation gespeist wird.
 *
 * Die Normalisierung ist deutsch-freundlich: Umlaute werden ausgeschrieben
 * („Küche" → „kueche"), Diakritika entfernt, alles Übrige wird zur Wortgrenze.
 * So findet „ki" die Seite „KI & Generatoren" und „kuche" die „Küche".
 */

export interface NavSearchEntry {
  /** Stabile Id (aus dem Navigations-Kontrakt). */
  id: string;
  label: string;
  /** App-relative Route (oder absolute URL bei `external`). */
  href: string;
  /** Lucide-Icon-Name (kebab-case) — nur Darstellung. */
  icon?: string;
  /** Kontexthinweis neben dem Treffer, z. B. „System / Betrieb". */
  group?: string;
  keywords?: string[];
  external?: boolean;
}

export interface NavSearchHit extends NavSearchEntry {
  /** Höher = besserer Treffer. Nur innerhalb einer Abfrage vergleichbar. */
  score: number;
}

export interface NavSearchOptions {
  /** Maximale Trefferzahl (Default: 8). */
  limit?: number;
}

const GERMAN_REPLACEMENTS: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
};

/** Kleinschreibung, Umlaute ausgeschrieben, Diakritika weg, Rest zu Wortgrenzen. */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => GERMAN_REPLACEMENTS[char] ?? char)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Abfrage in Suchwörter zerlegen (leere Abfrage → leere Liste). */
export function navSearchTokens(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(" ") : [];
}

/** Punktwerte je Trefferart — absteigend nach Aussagekraft. */
const SCORE = {
  labelExact: 120,
  labelPrefix: 100,
  labelWord: 80,
  keywordExact: 70,
  keywordWord: 55,
  labelPart: 40,
  keywordPart: 30,
  groupWord: 22,
  pathWord: 18,
  groupPart: 10,
  fuzzy: 5,
} as const;

interface PreparedEntry {
  index: number;
  label: string;
  labelWords: string[];
  keywords: string[];
  keywordWords: string[];
  group: string;
  groupWords: string[];
  pathWords: string[];
}

function splitWords(value: string): string[] {
  return value.split(" ").filter(Boolean);
}

function prepare(entry: NavSearchEntry, index: number): PreparedEntry {
  const label = normalizeSearchText(entry.label);
  const keywords = (entry.keywords ?? []).map(normalizeSearchText).filter(Boolean);
  const group = normalizeSearchText(entry.group ?? "");
  return {
    index,
    label,
    labelWords: splitWords(label),
    keywords,
    keywordWords: keywords.flatMap(splitWords),
    group,
    groupWords: splitWords(group),
    pathWords: splitWords(normalizeSearchText(entry.href.split("?")[0] ?? "")),
  };
}

/** Buchstaben in Reihenfolge — toleriert Abkürzungen wie „gnrtr" → „generatoren". */
function isSubsequence(token: string, haystack: string): boolean {
  let cursor = 0;
  for (const char of haystack) {
    if (char === token[cursor]) cursor += 1;
    if (cursor === token.length) return true;
  }
  return false;
}

/**
 * Treffer *innerhalb* eines Wortes bleiben längeren Suchwörtern vorbehalten:
 * „ki" soll „KI & Generatoren" finden, nicht jedes „Wiki".
 */
const MIN_INFIX_LENGTH = 3;

/** Bester Punktwert eines einzelnen Suchworts für einen Eintrag (0 = kein Treffer). */
function scoreToken(token: string, item: PreparedEntry): number {
  const allowInfix = token.length >= MIN_INFIX_LENGTH;
  if (item.label === token) return SCORE.labelExact;
  if (item.label.startsWith(token)) return SCORE.labelPrefix;
  if (item.labelWords.some((word) => word.startsWith(token))) return SCORE.labelWord;
  if (item.keywords.includes(token)) return SCORE.keywordExact;
  if (item.keywordWords.some((word) => word.startsWith(token))) return SCORE.keywordWord;
  if (allowInfix && item.label.includes(token)) return SCORE.labelPart;
  if (allowInfix && item.keywords.some((keyword) => keyword.includes(token))) {
    return SCORE.keywordPart;
  }
  if (item.groupWords.some((word) => word.startsWith(token))) return SCORE.groupWord;
  if (item.pathWords.some((word) => word.startsWith(token))) return SCORE.pathWord;
  if (allowInfix && item.group.includes(token)) return SCORE.groupPart;
  if (allowInfix && isSubsequence(token, item.label)) return SCORE.fuzzy;
  return 0;
}

/**
 * Navigationseinträge nach Relevanz für eine Abfrage sortieren.
 *
 * Jedes Suchwort muss irgendwo treffen (UND-Verknüpfung); die Punktwerte der
 * Wörter werden addiert. Gleichstand entscheidet das kürzere Label, danach die
 * ursprüngliche Reihenfolge — die Sortierung ist damit stabil und vorhersagbar.
 */
export function searchNavEntries(
  entries: NavSearchEntry[],
  query: string,
  options: NavSearchOptions = {},
): NavSearchHit[] {
  const tokens = navSearchTokens(query);
  if (tokens.length === 0) return [];

  const scored: { hit: NavSearchHit; index: number; labelLength: number }[] = [];

  entries.forEach((entry, index) => {
    const item = prepare(entry, index);
    let total = 0;
    for (const token of tokens) {
      const score = scoreToken(token, item);
      if (score === 0) return;
      total += score;
    }
    scored.push({ hit: { ...entry, score: total }, index, labelLength: item.label.length });
  });

  scored.sort(
    (a, b) =>
      b.hit.score - a.hit.score || a.labelLength - b.labelLength || a.index - b.index,
  );

  return scored.slice(0, options.limit ?? 8).map((row) => row.hit);
}

/**
 * Doppelte Ziele entfernen (erster Eintrag gewinnt).
 *
 * Studio speist die Suche aus mehreren Quellen (globale IA + Welt-Navigation);
 * ohne Dedupe stünde derselbe Bereich mehrfach im Vorschlagsfeld.
 */
export function dedupeNavSearchEntries(entries: NavSearchEntry[]): NavSearchEntry[] {
  const seen = new Set<string>();
  const result: NavSearchEntry[] = [];
  for (const entry of entries) {
    const key = entry.href.replace(/\/$/, "") || "/";
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}
