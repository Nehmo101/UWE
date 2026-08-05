/**
 * Im Band suchen.
 *
 * Ein Band ist ein fortlaufender Text aus Dutzenden Abschnitten. Zum Lesen ist
 * das genau richtig — zum **Wiederfinden** nicht: „in welchem Abschnitt stand
 * der Name des Wirts?" endet sonst im Scrollen. Browsersuche hilft nur im
 * geladenen Band und sagt nicht, wie viele Treffer wo liegen; über mehrere Bände
 * hinweg kann sie gar nichts.
 *
 * Dieses Modul rechnet aus Klartext und Suchbegriff eine Trefferliste mit
 * Textausschnitten, und markiert dieselben Treffer im fertigen HTML. Rein: keine
 * Datenbank, kein React — dieselbe Hausordnung wie in `volume.ts`.
 *
 * Gesucht wird als **Wortfolge**, nicht als Wortmenge: Groß-/Kleinschreibung ist
 * egal, Zeilenumbrüche und Mehrfach-Leerzeichen zählen als ein Leerzeichen.
 * „der  Wirt" findet also „Der\nWirt", aber nicht „Wirt der".
 */

import type { Volume, VolumeSection } from "./volume";

/** Kürzer sucht niemand sinnvoll — ein Buchstabe trifft alles. */
export const MIN_QUERY_LENGTH = 2;

/** Zeichen links und rechts des Treffers im Textausschnitt. */
const SNIPPET_RADIUS = 70;

/** Mehr Ausschnitte pro Abschnitt liest ohnehin niemand. */
const SNIPPETS_PER_SECTION = 3;

/** Sicherheitsnetz gegen „e" in einem 300-seitigen Band. */
const MAX_MATCHES_PER_TEXT = 200;

export interface TextRange {
  /** Index des ersten Zeichens im **Originaltext**. */
  start: number;
  /** Index hinter dem letzten Zeichen. */
  end: number;
}

/**
 * Ein Textausschnitt um einen Treffer, in drei Teilen — damit die Anzeige den
 * Treffer hervorheben kann, ohne selbst noch einmal suchen zu müssen.
 */
export interface SearchSnippet {
  before: string;
  match: string;
  after: string;
}

export interface SearchableSection {
  id: string;
  title: string;
  slug: string;
  type: string;
  depth: number;
  /** Sprungmarke im Lesetext. */
  anchor: string;
  /** Klartext des Abschnitts — ohne Tags, ohne Entities. */
  text: string;
}

export interface SectionHit {
  id: string;
  title: string;
  slug: string;
  type: string;
  depth: number;
  anchor: string;
  /** Treffer im Text (ohne den Titel). */
  matches: number;
  /** Steht der Begriff schon in der Überschrift? */
  titleMatch: boolean;
  snippets: SearchSnippet[];
}

export interface VolumeSearchResult {
  /** Der bereinigte Begriff, wie er gesucht wurde. */
  query: string;
  hits: SectionHit[];
  /** Treffer im Text über alle Abschnitte. */
  matches: number;
  /** Fertig markiertes HTML, nur für Abschnitte mit Treffern. */
  htmlById: Map<string, string>;
}

interface NormalizedText {
  /** Kleingeschrieben, Weißraum vereinheitlicht. */
  value: string;
  /** `offsets[i]` = Index von `value[i]` im Originaltext. */
  offsets: number[];
}

/**
 * Bereitet Text zum Vergleichen vor und merkt sich für jedes Zeichen, wo es im
 * Original stand.
 *
 * Der Offset-Mitschrieb ist der Kern: ohne ihn ließe sich ein Treffer in der
 * normalisierten Fassung nicht mehr auf die Stelle im Original zurückrechnen —
 * und genau die braucht sowohl der Ausschnitt als auch die Markierung im HTML.
 * Deshalb darf hier auch ein Zeichen zu mehreren werden (`ẛ̣` → zwei), das kostet
 * nur einen weiteren Eintrag mit demselben Original-Index.
 */
function normalize(text: string): NormalizedText {
  let value = "";
  const offsets: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (/\s/.test(char)) {
      // Ein Weißraum-Lauf wird ein Leerzeichen; führender fällt weg.
      if (value.length > 0 && value[value.length - 1] !== " ") {
        value += " ";
        offsets.push(index);
      }
      continue;
    }

    const lower = char.toLowerCase();
    value += lower;
    for (let repeat = 0; repeat < lower.length; repeat += 1) offsets.push(index);
  }

  return { value, offsets };
}

/** Der Suchbegriff, bereinigt — leer heißt „nicht suchen". */
export function normalizeQuery(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/\s+/g, " ");
  return trimmed.length >= MIN_QUERY_LENGTH ? trimmed : "";
}

/**
 * Alle Stellen, an denen `query` in `text` steht — als Bereiche im Original.
 *
 * Gesucht wird auf der normalisierten Fassung und über `offsets` zurückgerechnet.
 * Weitergesucht wird hinter dem Treffer, Überlappungen gibt es also nicht.
 */
export function findMatchRanges(text: string, query: string, limit = MAX_MATCHES_PER_TEXT): TextRange[] {
  const needle = normalize(query).value;
  if (!needle) return [];

  const haystack = normalize(text);
  const ranges: TextRange[] = [];

  let cursor = 0;
  while (ranges.length < limit) {
    const found = haystack.value.indexOf(needle, cursor);
    if (found === -1) break;

    const last = found + needle.length - 1;
    ranges.push({
      start: haystack.offsets[found],
      // Das letzte Zeichen kann im Original mehr als eines lang gewesen sein
      // (Weißraum-Lauf), deshalb bis zum nächsten Offset — oder bis zum Ende.
      end: last + 1 < haystack.offsets.length ? haystack.offsets[last + 1] : text.length,
    });
    cursor = found + needle.length;
  }

  return ranges;
}

/** Steht der Begriff irgendwo in `text`? */
export function matchesQuery(text: string, query: string): boolean {
  return findMatchRanges(text, query, 1).length > 0;
}

/** Schneidet an einer Wortgrenze ab, damit Ausschnitte nicht mitten im Wort beginnen. */
function trimToWord(text: string, fromStart: boolean): string {
  if (fromStart) {
    const space = text.indexOf(" ");
    return space === -1 ? text : text.slice(space + 1);
  }
  const space = text.lastIndexOf(" ");
  return space === -1 ? text : text.slice(0, space);
}

/** Ein Ausschnitt um `range`, mit „…" wo abgeschnitten wurde. */
export function buildSnippet(text: string, range: TextRange, radius = SNIPPET_RADIUS): SearchSnippet {
  const rawBefore = text.slice(Math.max(0, range.start - radius), range.start);
  const rawAfter = text.slice(range.end, range.end + radius);

  const cutStart = range.start - rawBefore.length > 0;
  const cutEnd = range.end + rawAfter.length < text.length;

  const before = cutStart ? `… ${trimToWord(rawBefore, true)}` : rawBefore;
  const after = cutEnd ? `${trimToWord(rawAfter, false)} …` : rawAfter;

  return { before, match: text.slice(range.start, range.end), after };
}

/**
 * Sucht in einer Liste Abschnitte.
 *
 * Reihenfolge bleibt die der Eingabe — im Band ist das die Lesereihenfolge, und
 * „wo kommt das zuerst vor" ist beim Vorbereiten die nützlichere Sortierung als
 * „wo kommt es am häufigsten vor".
 */
export function searchSections(
  sections: SearchableSection[],
  query: string,
  options: { snippetsPerSection?: number } = {},
): SectionHit[] {
  const cleaned = normalizeQuery(query);
  if (!cleaned) return [];

  const perSection = options.snippetsPerSection ?? SNIPPETS_PER_SECTION;
  const hits: SectionHit[] = [];

  for (const section of sections) {
    const ranges = findMatchRanges(section.text, cleaned);
    const titleMatch = matchesQuery(section.title, cleaned);
    if (ranges.length === 0 && !titleMatch) continue;

    hits.push({
      id: section.id,
      title: section.title,
      slug: section.slug,
      type: section.type,
      depth: section.depth,
      anchor: section.anchor,
      matches: ranges.length,
      titleMatch,
      snippets: ranges.slice(0, perSection).map((range) => buildSnippet(section.text, range)),
    });
  }

  return hits;
}

/**
 * Bereiche im HTML, die **Text** sind — also nicht Tag und nicht Entity.
 *
 * Alles andere bleibt für die Suche unsichtbar. Ein Attributwert darf nie
 * getroffen werden, sonst schiebt die Markierung ein `<mark>` mitten in ein
 * `href` und zerlegt das Markup; eine Entity darf nicht getroffen werden, weil
 * ein `<mark>` in `&amp;` aus dem Zeichen wieder Buchstaben macht.
 */
function htmlTextRanges(html: string): TextRange[] {
  const ranges: TextRange[] = [];
  let textStart = 0;

  const push = (end: number) => {
    if (end > textStart) ranges.push({ start: textStart, end });
  };

  for (let index = 0; index < html.length; index += 1) {
    const char = html[index];

    if (char === "<") {
      push(index);
      const close = html.indexOf(">", index);
      if (close === -1) return ranges;
      index = close;
      textStart = index + 1;
      continue;
    }

    if (char === "&") {
      const entity = /^&#?[a-zA-Z0-9]{1,10};/.exec(html.slice(index));
      if (!entity) continue;
      push(index);
      index += entity[0].length - 1;
      textStart = index + 1;
    }
  }

  push(html.length);
  return ranges;
}

/**
 * Trennzeichen zwischen den Textstuecken beim Markieren.
 *
 * Muss ein Zeichen sein, das in einem Suchbegriff NIE vorkommt - sonst koennte
 * ein Treffer ueber eine Tag-Grenze hinweg passen, und das eingesetzte <mark>
 * wuerde offenes gegen geschlossenes Markup verschraenken. Ein Leerzeichen waere
 * hier also falsch.
 */
const SEGMENT_SEPARATOR = "\u0000";

/**
 * Tags, die **im** Wort stehen dürfen.
 *
 * Ein Blocktag trennt Text, ein Inline-Tag nicht: aus `<a>Aetherit</a>-Gilde`
 * wird „Aetherit-Gilde", nicht „Aetherit -Gilde". Der Unterschied ist sichtbar,
 * denn genau dieser Text landet in den Ausschnitten — und er ist auch der Text,
 * in dem gesucht wird: mit Leerzeichen fände „Aetherit-Gilde" nichts.
 */
const INLINE_TAGS = new Set([
  "a", "abbr", "b", "bdi", "bdo", "cite", "code", "data", "del", "dfn", "em", "i", "ins", "kbd",
  "mark", "q", "rp", "rt", "ruby", "s", "samp", "small", "span", "strong", "sub", "sup", "time",
  "u", "var", "wbr",
]);

/**
 * Der reine Text eines HTML-Abschnitts.
 *
 * Für Trefferlisten und Ausschnitte: Tags weg, die vom Sanitizer erzeugten
 * Entities zurückübersetzt, Weißraum zusammengefasst. Blockgrenzen werden zu
 * einem Leerzeichen — ohne das klebte das Ende eines Absatzes am Anfang des
 * nächsten und ergäbe Treffer, die im Text nicht stehen.
 */
export function plainTextFromHtml(html: string): string {
  // Nicht über `htmlTextRanges`: das lässt Entities bewusst außen vor, weil dort
  // nie markiert werden darf. Hier sollen sie im Gegenteil zurückübersetzt
  // werden — ein Ausschnitt mit „&amp;" darin liest sich falsch.
  return (
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*>/g, (_tag, name: string) =>
        INLINE_TAGS.has(name.toLowerCase()) ? "" : " ",
      )
      // Was danach noch wie ein Tag aussieht, ist keins mit Namen — weg damit.
      .replace(/<[^>]*>/g, " ")
      // Erst die benannten Entities, `&amp;` als Letztes: sonst würde aus
      // `&amp;lt;` (im Text sichtbares „&lt;") ein „<".
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Markiert alle Treffer im HTML mit `<mark class="uwe-treffer">`.
 *
 * Gesucht wird nur in den Textstücken, und die werden mit einem Trennzeichen
 * verkettet, das kein Treffer überspringen kann — ein Treffer liegt damit
 * garantiert **innerhalb eines** Textstücks. Nur so lässt sich das `<mark>`
 * einsetzen, ohne Markup zu zerlegen.
 *
 * Der Preis: eine Wortfolge, die im HTML durch ein Tag getrennt ist
 * („des <em>Turms</em>"), wird nicht markiert. Die Trefferliste findet sie
 * trotzdem, denn die arbeitet auf dem Klartext.
 */
export function highlightHtml(html: string, query: string): string {
  const cleaned = normalizeQuery(query);
  if (!cleaned) return html;

  const segments = htmlTextRanges(html);
  if (segments.length === 0) return html;

  const joined = segments.map((range) => html.slice(range.start, range.end)).join(SEGMENT_SEPARATOR);
  const ranges = findMatchRanges(joined, cleaned);
  if (ranges.length === 0) return html;

  // Position im verketteten Text → Position im HTML.
  const toHtmlIndex = (index: number): number => {
    let offset = 0;
    for (const segment of segments) {
      const length = segment.end - segment.start;
      if (index <= offset + length) return segment.start + (index - offset);
      offset += length + SEGMENT_SEPARATOR.length;
    }
    return html.length;
  };

  let result = "";
  let cursor = 0;
  for (const range of ranges) {
    const start = toHtmlIndex(range.start);
    const end = toHtmlIndex(range.end);
    if (start < cursor) continue;

    result += html.slice(cursor, start);
    result += `<mark class="uwe-treffer">${html.slice(start, end)}</mark>`;
    cursor = end;
  }

  return result + html.slice(cursor);
}

/** Ein Abschnitt des Bandes, zum Suchen aufbereitet. */
export function sectionToSearchable(section: VolumeSection): SearchableSection {
  return {
    id: section.id,
    title: section.title,
    slug: section.slug,
    type: section.type,
    depth: section.depth,
    anchor: section.anchor,
    text: plainTextFromHtml(section.html),
  };
}

/**
 * Sucht in einem Band: Trefferliste plus markiertes HTML.
 *
 * Markiert wird nur, was Treffer hat — über die anderen fünfzig Abschnitte
 * zweimal zu laufen brächte nichts. Wer den Lesetext gar nicht anzeigt (eine
 * Trefferübersicht über mehrere Bände etwa), schaltet mit `highlight: false`
 * auch das ab.
 */
export function searchVolume(
  volume: Volume,
  query: string,
  options: { snippetsPerSection?: number; highlight?: boolean } = {},
): VolumeSearchResult {
  const cleaned = normalizeQuery(query);
  const empty: VolumeSearchResult = { query: cleaned, hits: [], matches: 0, htmlById: new Map() };
  if (!cleaned) return empty;

  const hits = searchSections(volume.sections.map(sectionToSearchable), cleaned, options);
  if (hits.length === 0) return empty;

  const withMatches =
    options.highlight === false
      ? new Set<string>()
      : new Set(hits.filter((hit) => hit.matches > 0).map((hit) => hit.id));
  const htmlById = new Map<string, string>();
  for (const section of volume.sections) {
    if (withMatches.has(section.id)) htmlById.set(section.id, highlightHtml(section.html, cleaned));
  }

  return {
    query: cleaned,
    hits,
    matches: hits.reduce((total, hit) => total + hit.matches, 0),
    htmlById,
  };
}
