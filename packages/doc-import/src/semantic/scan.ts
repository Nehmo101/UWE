/**
 * Zeichenweises Lesen statt Mustersuche.
 *
 * Dieses Package hat mit Regexen auf hochgeladenen Dokumenten eine Vorgeschichte:
 * Vier Ausdrücke brauchten für 16 000 Zeichen rund 200 ms — pro Zeile, bei 1 778
 * Zeilen im Buch. Die Ursache ist immer dieselbe Form:
 *
 * - **Streitende Quantifizierer.** `\s*(.*?)\s*\*\*` — die beiden `\s*` und die
 *   Gruppe dazwischen greifen nach denselben Leerzeichen. Findet sich kein
 *   Abschluss, probiert die Maschine jede Aufteilung durch.
 * - **`+$` am Zeilenende.** `[.,;:]+$` sieht harmlos aus, wird aber an *jeder*
 *   Position neu angesetzt und läuft von dort bis zum Ende. Das ist quadratisch,
 *   auch ohne Rückverfolgung.
 * - **Suchen ohne Fund.** `\[\[[^\]]*\]\]` über einen Text voller `[[` ohne
 *   Gegenstück: Jeder Startpunkt scannt bis zum Textende.
 *
 * Die Antwort ist überall dieselbe und steht schon in `doc-tree.ts`: von Hand
 * lesen. Ein Durchlauf, jede Regel eine Zeile, Laufzeit linear und ablesbar.
 * Hier stehen die Bausteine, die sich mehrere Module teilen.
 */

const SPACE = new Set([" ", "\t"]);

/** Leerzeichen und Tabulator — nicht `\s`, das fräße geschützte Leerzeichen. */
export function isBlank(char: string | undefined): boolean {
  return char !== undefined && SPACE.has(char);
}

/** Schneidet am Ende alles weg, was `drop` bejaht. Ein Durchlauf, rückwärts. */
export function trimEndWhere(value: string, drop: (char: string) => boolean): string {
  let end = value.length;
  while (end > 0 && drop(value[end - 1])) end -= 1;
  return value.slice(0, end);
}

/** Dasselbe von vorn. */
export function trimStartWhere(value: string, drop: (char: string) => boolean): string {
  let start = 0;
  while (start < value.length && drop(value[start])) start += 1;
  return value.slice(start);
}

/**
 * Zieht Folgen von Leerraum auf ein Leerzeichen zusammen.
 *
 * Ersetzt `replace(/\s+/g, " ")`. Zeilenumbrüche gelten dabei als Leerraum —
 * die Aufrufer arbeiten auf einzelnen Zeilen oder auf Titeln.
 */
export function collapseBlanks(value: string): string {
  let out = "";
  let pending = false;

  for (const char of value) {
    if (char === " " || char === "\t" || char === "\n" || char === "\r") {
      pending = out.length > 0;
      continue;
    }
    if (pending) out += " ";
    pending = false;
    out += char;
  }

  return out;
}

export interface Delimited {
  /** Text zwischen den Begrenzern. */
  inner: string;
  /** Was nach dem schließenden Begrenzer steht. */
  rest: string;
}

/**
 * Liest `open … close` am Anfang einer Zeile.
 *
 * Kein Fund heißt: einmal bis zum Ende geschaut und aufgegeben — nicht an jeder
 * Position neu ansetzen. Genau daran krankten die Suchen nach `[[…]]` und
 * `**…**`.
 */
export function readDelimited(line: string, open: string, close: string): Delimited | null {
  if (!line.startsWith(open)) return null;

  const end = line.indexOf(close, open.length);
  if (end < 0) return null;

  return { inner: line.slice(open.length, end), rest: line.slice(end + close.length) };
}

/**
 * Alle Vorkommen von `open … close` im Text, als Bereiche.
 *
 * Ein Durchlauf: Fehlt der Abschluss, ist Schluss — statt für jeden weiteren
 * Anfang erneut bis zum Textende zu laufen.
 */
export function findDelimitedRanges(
  text: string,
  open: string,
  close: string,
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let from = 0;

  while (from < text.length) {
    const start = text.indexOf(open, from);
    if (start < 0) break;

    const end = text.indexOf(close, start + open.length);
    if (end < 0) break;

    ranges.push([start, end + close.length]);
    from = end + close.length;
  }

  return ranges;
}

export interface HeadingLine {
  level: number;
  /** Der Leerraum zwischen Rauten und Text — bleibt beim Umschreiben erhalten. */
  gap: string;
  title: string;
}

/**
 * Liest eine Markdown-Überschrift.
 *
 * Dieselbe Regel wie `matchHeading` in `doc-tree.ts`, hier für den Fall, dass
 * die Zeile umgeschrieben statt nur erkannt wird: keine Raute am Anfang → keine
 * Überschrift; mehr als sechs → keine; kein Leerraum dahinter → keine; nur
 * Rauten und Leerraum ohne Text → auch keine.
 */
export function readHeadingLine(line: string): HeadingLine | null {
  let level = 0;
  while (level < line.length && line[level] === "#") level += 1;
  if (level === 0 || level > 6) return null;

  let start = level;
  while (start < line.length && isBlank(line[start])) start += 1;
  if (start === level) return null;

  const title = line.slice(start);
  return title ? { level, gap: line.slice(level, start), title } : null;
}
