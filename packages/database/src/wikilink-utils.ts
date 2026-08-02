export interface ParsedWikiLink {
  /** Raw target text inside [[...]] before the pipe. */
  target: string;
  /** Optional display label after the pipe. */
  label?: string;
  /** Character offset where the wikilink starts in source text. */
  start: number;
  /** Character offset where the wikilink ends in source text. */
  end: number;
}

/**
 * Zeichen, die den Zielteil eines Wikilinks beenden: `]` schließt ihn, `|`
 * trennt Ziel und Beschriftung.
 */
function isTargetStop(character: string): boolean {
  return character === "]" || character === "|";
}

/**
 * Versucht, an `open` (dort steht `[[`) einen Wikilink zu lesen.
 *
 * Gibt zusätzlich `stop` zurück: die Stelle, an der der Zielteil endete. Die
 * braucht der Aufrufer, um nach einem Fehlschlag weiterzuspringen — siehe
 * `parseWikiLinks`.
 */
function readWikiLinkAt(
  text: string,
  open: number,
): { link: ParsedWikiLink | null; stop: number } {
  const targetStart = open + 2;
  let cursor = targetStart;
  while (cursor < text.length && !isTargetStop(text[cursor])) {
    cursor += 1;
  }
  const stop = cursor;

  // Der Zielteil braucht mindestens ein Zeichen.
  if (stop === targetStart) {
    return { link: null, stop };
  }
  const target = text.slice(targetStart, stop);

  let label: string | undefined;
  if (text[cursor] === "|") {
    cursor += 1;
    const labelStart = cursor;
    while (cursor < text.length && text[cursor] !== "]") {
      cursor += 1;
    }
    if (cursor === labelStart) {
      return { link: null, stop };
    }
    label = text.slice(labelStart, cursor);
  }

  if (text[cursor] !== "]" || text[cursor + 1] !== "]") {
    return { link: null, stop };
  }

  return {
    link: {
      target: target.trim(),
      label: label?.trim(),
      start: open,
      end: cursor + 2,
    },
    stop,
  };
}

/**
 * Parse [[wikilink]] syntax from markdown text.
 *
 * **Warum das kein `while (pattern.exec(text))` mehr ist.** Es war eines:
 * `/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g`. Die Regex ist quadratisch, sobald
 * jemand viele `[[` hintereinander schreibt, ohne sie je zu schließen: Bei
 * jedem `[[` läuft `[^\]|]+` bis ans Textende, findet kein `]]`, und die Suche
 * beginnt beim nächsten Zeichen von vorn. Der Text ist Seiteninhalt — nichts
 * daran ist so vertrauenswürdig, dass es diese Rechenzeit wert wäre. Dieselbe
 * Überlegung steht schon hinter `stripTags` in `@uwe/doc-import` und hinter der
 * Suche nach dem schließenden Überschriften-Tag in `page-service.ts`.
 *
 * **Die Semantik bleibt Zeichen für Zeichen dieselbe** — `wikilink-utils.test.ts`
 * vergleicht diese Funktion gegen die alte Regex über erzeugte Eingaben, weil
 * die Offsets weiterreichen: Renderer, Graph und Backlinks rechnen mit ihnen.
 *
 * **Warum es jetzt linear ist.** Scheitert der Versuch an `open`, dann scheitert
 * jedes weitere `[[`, das noch vor dem Stoppzeichen beginnt, aus genau demselben
 * Grund: Zwischen `open + 2` und dem Stopp steht weder `]` noch `|`, ein später
 * beginnender Zielteil endet also an derselben Stelle und trifft dort dieselbe
 * Entscheidung. Die Suche darf deshalb bis kurz vor den Stopp springen, statt um
 * ein Zeichen weiterzurücken — und jedes Zeichen wird nur einmal angesehen.
 */
export function parseWikiLinks(text: string): ParsedWikiLink[] {
  const links: ParsedWikiLink[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const open = text.indexOf("[[", cursor);
    if (open < 0) break;

    const { link, stop } = readWikiLinkAt(text, open);
    if (link) {
      links.push(link);
      cursor = link.end;
      continue;
    }

    // `stop - 2` ist die erste Stelle, an der ein `[[` noch etwas anderes
    // erleben kann als dieses hier: dort wäre der Zielteil leer.
    cursor = Math.max(open + 1, stop - 2);
  }

  return links;
}
