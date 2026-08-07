/**
 * Namen im Text zu Wikilinks machen.
 *
 * Ein Kampagnenbuch verweist ständig auf sich selbst — „3 Bannläufer (F.2)",
 * „Nepurga wartet auf dem Dach", „siehe C.4.3". Solange das Fließtext bleibt,
 * ist der Seitenbaum nur ein Inhaltsverzeichnis. Erst wenn diese Namen klickbar
 * sind, wird aus dem Import ein Wiki.
 *
 * **Was hier passiert.** Der erste Fund eines Gegenstandsnamens pro Seite wird
 * zu `[[Name]]`. Der erste, nicht jeder: Eine Seite, auf der „Nepurga" achtmal
 * verlinkt ist, liest sich wie eine Werbeanzeige. Aufgelöst wird zur Laufzeit
 * gegen den Welt-Index, wie bei jedem anderen Wikilink auch — ein Ziel, das
 * später entsteht, heilt den Link von selbst.
 *
 * **Was hier nicht passiert.** Nichts wird in Codeblöcken, in Überschriften, in
 * bestehenden `[[…]]` oder in Markdown-Linkzielen ersetzt. Und keine Seite
 * verlinkt sich selbst.
 */

import { findDelimitedRanges } from "./scan";

const FENCE = /^(?:```|~~~)/;

export interface LinkTarget {
  /** Seitentitel — steht so im Text und wird so verlinkt. */
  title: string;
  /** Weitere Schreibweisen, unter denen der Gegenstand auftaucht (`F.2`). */
  aliases?: string[];
}

interface Candidate {
  /** Kleingeschrieben, für den Vergleich. */
  needle: string;
  /** Der Titel, auf den verlinkt wird. */
  title: string;
  /** Der Text, der im Dokument steht — bleibt sichtbar. */
  surface: string;
}

/** Kürzere Namen sind zu unspezifisch: „Der Ring" ja, „Ring" nein. */
const MIN_NEEDLE_LENGTH = 5;

/** Wörter, die als Seitentitel vorkommen, aber im Fließtext nichts bedeuten. */
const STOPWORDS = new Set([
  "der kampf",
  "die räume",
  "handouts",
  "werteblöcke",
  "danach",
  "beute",
  "flucht",
  "geheimnis",
  "der tod",
]);

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}_]/u.test(char);
}

/**
 * Baut die Kandidatenliste, längster Name zuerst.
 *
 * Die Reihenfolge entscheidet: Steht „Magister Orvin Quell" im Text und sind
 * beide Seiten bekannt, soll der lange Name gewinnen, nicht „Orvin Quell" als
 * Teilstück darin.
 */
function buildCandidates(targets: LinkTarget[], exclude: string): Candidate[] {
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  const excluded = exclude.trim().toLocaleLowerCase("de");

  for (const target of targets) {
    const title = target.title.trim();
    // Ein Titel mit Klammern oder senkrechtem Strich ließe sich nicht in einen
    // Wikilink schreiben, ohne ihn zu zerlegen. Solche Seiten bleiben erreichbar,
    // nur eben nicht durch automatische Verlinkung.
    if (!title || /[[\]|]/.test(title)) continue;

    for (const surface of [title, ...(target.aliases ?? [])]) {
      const value = surface.trim();
      if (value.length < MIN_NEEDLE_LENGTH) continue;

      const needle = value.toLocaleLowerCase("de");
      if (needle === excluded || STOPWORDS.has(needle) || seen.has(needle)) continue;

      seen.add(needle);
      candidates.push({ needle, title, surface: value });
    }
  }

  return candidates.sort((a, b) => b.needle.length - a.needle.length);
}

/**
 * Stellen im Text, an denen nicht ersetzt werden darf.
 *
 * Ein einziger Durchlauf, der Codezäune, Überschriften, bestehende Wikilinks
 * und Markdown-Linkziele als gesperrte Bereiche einsammelt. Danach ist die
 * Ersetzung eine reine Indexfrage.
 */
/**
 * Führende Zitatzeichen und Einrückung abziehen: `>   > | a |` → `| a |`.
 *
 * Von Hand statt per Muster. `^(?:\s*>)+\s*` lässt zwei Quantoren um dieselben
 * Leerzeichen streiten und ist auf einer Zeile aus lauter Leerraum quadratisch —
 * derselbe Grund wie bei `stripTags` und `parseWikiLinks`.
 */
function stripQuoteMarkers(line: string): string {
  let index = 0;
  for (;;) {
    while (index < line.length && (line[index] === " " || line[index] === "\t")) index += 1;
    if (line[index] !== ">") break;
    index += 1;
  }
  return line.slice(index).trim();
}

function blockedRanges(markdown: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let offset = 0;
  let inFence = false;

  for (const line of markdown.split("\n")) {
    // Zitatzeichen zuerst abziehen. Eine Tabelle in einem Blockzitat ist immer
    // noch eine Tabelle — `> | a | b |` beginnt aber mit `>`, und ohne diesen
    // Schritt fiel sie durch die Sperre unten hindurch. Gemessen an einem
    // Handout, dessen Zeile danach eine Spalte verloren hatte:
    //
    //     | Gesa Lemm | Validori, Rauchring | schuldet Wett |
    //     → <td>Validori, [[Der Rauchring</td><td>Rauchring]]</td>
    //
    // Dasselbe gilt für zitierte Überschriften und Codezäune.
    const trimmed = stripQuoteMarkers(line);

    if (FENCE.test(trimmed)) {
      inFence = !inFence;
      ranges.push([offset, offset + line.length]);
    } else if (inFence || trimmed.startsWith("#") || trimmed.startsWith("|")) {
      // Tabellenzeilen bleiben außen vor: ein `[[Ziel|Text]]` darin bekäme eine
      // Spalte zu viel, weil der senkrechte Strich in Markdown die Zelle trennt.
      ranges.push([offset, offset + line.length]);
    }

    offset += line.length + 1;
  }

  // Von Hand gesucht, nicht per Muster: `\[\[[^\]]*\]\]` setzt bei jedem `[[` ohne
  // Gegenstück neu an und läuft von dort bis zum Textende — quadratisch auf
  // einem Dokument voller offener Klammern.
  ranges.push(...findDelimitedRanges(markdown, "[[", "]]"));
  // Markdown-Links: der sichtbare Text darf verlinkt werden, das Ziel nicht.
  ranges.push(...findDelimitedRanges(markdown, "](", ")"));

  return ranges;
}

function isBlocked(ranges: Array<[number, number]>, start: number, end: number): boolean {
  return ranges.some(([from, to]) => start < to && end > from);
}

/**
 * Ersetzt den ersten Fund jedes Gegenstandsnamens durch einen Wikilink.
 *
 * `exclude` ist der Titel der Seite selbst — sonst verlinkte „Nepurga" auf
 * „Nepurga".
 */
export function linkEntityNames(markdown: string, targets: LinkTarget[], exclude = ""): string {
  if (!markdown.trim() || targets.length === 0) return markdown;

  const candidates = buildCandidates(targets, exclude);
  if (candidates.length === 0) return markdown;

  const ranges = blockedRanges(markdown);
  const haystack = markdown.toLocaleLowerCase("de");
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  for (const candidate of candidates) {
    let from = 0;

    while (from <= haystack.length - candidate.needle.length) {
      const at = haystack.indexOf(candidate.needle, from);
      if (at < 0) break;

      const end = at + candidate.needle.length;
      const boundary = !isWordChar(markdown[at - 1]) && !isWordChar(markdown[end]);
      const overlaps = replacements.some((item) => at < item.end && end > item.start);

      if (boundary && !overlaps && !isBlocked(ranges, at, end)) {
        const surface = markdown.slice(at, end);
        const text =
          surface.toLocaleLowerCase("de") === candidate.title.toLocaleLowerCase("de")
            ? `[[${surface}]]`
            : `[[${candidate.title}|${surface}]]`;
        replacements.push({ start: at, end, text });
        break;
      }

      from = at + 1;
    }
  }

  if (replacements.length === 0) return markdown;

  replacements.sort((a, b) => a.start - b.start);

  let out = "";
  let cursor = 0;
  for (const item of replacements) {
    out += markdown.slice(cursor, item.start) + item.text;
    cursor = item.end;
  }

  return out + markdown.slice(cursor);
}
