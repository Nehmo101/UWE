/**
 * Der DM-Bereich im Wikitext.
 *
 * Seit dem Wegfall der Sichtbarkeiten gilt: wer einer Welt zugeordnet ist,
 * sieht darin alles. Das bleibt so — für ganze Seiten, Blöcke, Bilder. Was
 * gefehlt hat, ist die kleine Ausnahme mitten im Fließtext: die Zeilen, die der
 * DM sich selbst notiert und die am Spieltisch niemand sonst lesen soll.
 *
 * Dafür gibt es eine Marke im Text selbst:
 *
 * ```
 * :::dm Der wahre Verräter
 * Hauptmann Roderick arbeitet für die Gegenseite.
 * :::
 * ```
 *
 * Alles zwischen `:::dm` und `:::` ist DM-Bereich. Wer das Studio-Häkchen
 * trägt (und der Owner) liest ihn; alle anderen bekommen ihn gar nicht erst
 * geschickt — er wird serverseitig aus dem Inhalt geschnitten, bevor gerendert
 * wird. Siehe `canReadDmSections` in `permissions.ts`.
 *
 * **Warum eine Textmarke und kein eigener Blocktyp.** Ein Blocktyp wäre grob:
 * er trennt DM-Notiz und Vorlesetext in zwei Kästen, obwohl sie im Kopf des DM
 * zusammengehören. Die Marke steht mitten im Absatzfluss, überlebt den
 * TipTap-Editor unverändert (sie ist für ihn ein gewöhnlicher Absatz), und der
 * Markdown-Import kann sie mitbringen, ohne dass der Importer etwas davon
 * wissen muss.
 *
 * **Was dieses Modul kann und was nicht.** Es findet und schneidet — es
 * entscheidet nicht, wer darf. Diese Entscheidung liegt bei `permissions.ts`.
 * Das Modul ist bewusst abhängigkeitsfrei und arbeitet auf dem rohen
 * Block-Inhalt: sowohl auf Wikitext („Zeilen") als auch auf dem HTML, das der
 * Rich-Text-Editor speichert (`<p>:::dm</p>`). Beides kommt in derselben
 * Spalte vor, also muss beides funktionieren.
 *
 * **Fail-closed:** Eine öffnende Marke ohne Gegenstück macht den gesamten Rest
 * des Textes zum DM-Bereich. Ein vergessenes `:::` verschweigt damit zu viel —
 * nie zu wenig.
 */

/** Öffnende Marke. Ein Titel dahinter ist erlaubt: `:::dm Der wahre Verräter`. */
export const DM_SECTION_OPEN = ":::dm";

/** Schließende Marke. Steht allein auf ihrer Zeile. */
export const DM_SECTION_CLOSE = ":::";

/** Ein Marken-Vorlauf, an dem `hasDmSection` billig aussteigen kann. */
const MARKER_PREFIX = ":::";

/**
 * Block-Tags, die eine allein stehende Marke umschließen dürfen und dann
 * mitgeschnitten werden. Ohne das bliebe vom `<p>:::dm</p>` des Editors ein
 * leerer Absatz übrig.
 */
const WRAPPER_TAGS = new Set(["p", "div", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6"]);

export interface DmSectionRange {
  /** Beginn der öffnenden Marke, inklusive umschließendem Block-Tag. */
  start: number;
  /** Ende der schließenden Marke, inklusive umschließendem Block-Tag. */
  end: number;
  /** Beginn des Inhalts zwischen den Marken. */
  bodyStart: number;
  /** Ende des Inhalts zwischen den Marken. */
  bodyEnd: number;
  /** Titel hinter `:::dm`, falls einer angegeben wurde. */
  title: string | null;
  /** Keine schließende Marke gefunden — der Bereich läuft bis zum Textende. */
  unclosed: boolean;
}

/** Ein Abschnitt des Inhalts: entweder DM-Bereich oder alles andere. */
export interface DmSegment {
  dm: boolean;
  text: string;
  title: string | null;
  /** Fundstelle im Ausgangstext — der Renderer teilt darüber die Wikilinks auf. */
  start: number;
  end: number;
}

interface Marker {
  kind: "open" | "close";
  /** Beginn der Marke selbst. */
  tokenStart: number;
  /** Ende der Marke selbst. */
  tokenEnd: number;
  /** Beginn inklusive umschließendem Block-Tag. */
  start: number;
  /** Ende inklusive umschließendem Block-Tag und folgendem Zeilenumbruch. */
  end: number;
  title: string | null;
}

function isSpace(character: string | undefined): boolean {
  return character === " " || character === "\t";
}

function isWhitespace(character: string | undefined): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r";
}

/**
 * Steht die Marke am Anfang ihrer Zeile?
 *
 * „Zeile" heißt hier: Textanfang, ein Zeilenumbruch — oder das Ende eines
 * HTML-Tags. Der Rich-Text-Editor speichert ohne Zeilenumbrüche, dort ist
 * `</p><p>:::dm` der einzige Zeilenanfang, den es gibt.
 */
function startsLine(content: string, index: number): boolean {
  let cursor = index - 1;
  while (cursor >= 0 && isSpace(content[cursor])) {
    cursor -= 1;
  }
  if (cursor < 0) return true;
  const character = content[cursor];
  return character === "\n" || character === "\r" || character === ">";
}

/** Liest bis zum Zeilenende — oder bis zum nächsten Tag, was zuerst kommt. */
function readToLineEnd(content: string, from: number): string {
  let cursor = from;
  while (cursor < content.length) {
    const character = content[cursor];
    if (character === "\n" || character === "\r" || character === "<") break;
    cursor += 1;
  }
  return content.slice(from, cursor);
}

/**
 * Zieht die Grenzen einer Marke bis über ein Block-Tag hinaus, das nichts
 * anderes enthält als die Marke — plus den folgenden Zeilenumbruch.
 *
 * Ohne das bliebe beim Schneiden ein `<p></p>` stehen (Editor-Inhalt) oder eine
 * Leerzeile (Wikitext). Umschlossen wird nur, wenn das Tag unmittelbar davor
 * öffnet und unmittelbar danach schließt; ein `<p>Text :::dm</p>` bleibt
 * unangetastet — es ist ohnehin keine Marke, weil sie dort nicht am Zeilenanfang
 * steht.
 */
function expandMarker(content: string, tokenStart: number, tokenEnd: number): { start: number; end: number } {
  let start = tokenStart;
  let end = tokenEnd;

  let before = tokenStart - 1;
  while (before >= 0 && isWhitespace(content[before])) {
    before -= 1;
  }

  if (before >= 0 && content[before] === ">") {
    const open = content.lastIndexOf("<", before);
    const tagSource = open >= 0 ? content.slice(open + 1, before) : "";
    const tagMatch = /^([a-z][a-z0-9]*)(\s[^<>]*)?$/i.exec(tagSource);
    const tag = tagMatch?.[1]?.toLowerCase();

    if (tag && WRAPPER_TAGS.has(tag)) {
      let after = tokenEnd;
      while (after < content.length && isWhitespace(content[after])) {
        after += 1;
      }
      const trailingBreak = /^<br\s*\/?>/i.exec(content.slice(after));
      if (trailingBreak) {
        after += trailingBreak[0].length;
      }

      const closing = `</${tag}`;
      if (content.slice(after, after + closing.length).toLowerCase() === closing) {
        const closingEnd = content.indexOf(">", after + closing.length);
        if (closingEnd >= 0) {
          start = open;
          end = closingEnd + 1;
        }
      }
    }
  }

  if (content[end] === "\r" && content[end + 1] === "\n") {
    end += 2;
  } else if (content[end] === "\n") {
    end += 1;
  }

  return { start, end };
}

function scanMarkers(content: string): Marker[] {
  const markers: Marker[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const at = content.indexOf(MARKER_PREFIX, cursor);
    if (at < 0) break;
    cursor = at + MARKER_PREFIX.length;

    if (!startsLine(content, at)) continue;

    let bodyAt = at + MARKER_PREFIX.length;
    while (isSpace(content[bodyAt])) {
      bodyAt += 1;
    }

    const rest = readToLineEnd(content, bodyAt);
    const trimmed = rest.trim();

    if (/^dm\b/i.test(trimmed)) {
      const tokenEnd = bodyAt + rest.trimEnd().length;
      const title = trimmed.slice(2).replace(/^[\s:—–-]+/, "").trim();
      markers.push({
        kind: "open",
        tokenStart: at,
        tokenEnd,
        title: title || null,
        ...expandMarker(content, at, tokenEnd),
      });
      cursor = tokenEnd;
      continue;
    }

    if (trimmed === "") {
      const tokenEnd = at + MARKER_PREFIX.length;
      markers.push({
        kind: "close",
        tokenStart: at,
        tokenEnd,
        title: null,
        ...expandMarker(content, at, tokenEnd),
      });
      cursor = tokenEnd;
    }
  }

  return markers;
}

/**
 * Findet alle DM-Bereiche in einem Block-Inhalt, in Dokumentreihenfolge und
 * ohne Überlappung.
 *
 * Verschachtelung gibt es nicht: das erste `:::` nach einem `:::dm` schließt
 * den Bereich, ein zweites `:::dm` davor wird ignoriert.
 */
export function findDmSections(content: string): DmSectionRange[] {
  if (!content || !content.includes(MARKER_PREFIX)) return [];

  const sections: DmSectionRange[] = [];
  let open: Marker | null = null;

  for (const marker of scanMarkers(content)) {
    if (marker.kind === "open") {
      if (!open) open = marker;
      continue;
    }
    if (!open) continue;

    sections.push({
      start: open.start,
      end: marker.end,
      bodyStart: open.end,
      bodyEnd: marker.start,
      title: open.title,
      unclosed: false,
    });
    open = null;
  }

  if (open) {
    // Fail-closed: eine Marke ohne Gegenstück verschweigt den Rest der Seite,
    // statt ihn versehentlich freizugeben.
    sections.push({
      start: open.start,
      end: content.length,
      bodyStart: open.end,
      bodyEnd: content.length,
      title: open.title,
      unclosed: true,
    });
  }

  return sections;
}

/** Steht in diesem Inhalt ein DM-Bereich? */
export function hasDmSection(content: string): boolean {
  return findDmSections(content).length > 0;
}

/**
 * Entfernt alle DM-Bereiche samt ihrer Marken.
 *
 * Das ist der Schnitt, den jeder Leser ohne Studio-Häkchen bekommt. Inhalte
 * ohne Marke kommen unverändert zurück — auch identisch, nicht nur gleich.
 */
export function stripDmSections(content: string): string {
  const sections = findDmSections(content);
  if (sections.length === 0) return content;

  let out = "";
  let cursor = 0;
  for (const section of sections) {
    out += content.slice(cursor, section.start);
    cursor = section.end;
  }
  out += content.slice(cursor);

  return out;
}

/** Die DM-Bereiche als Rohtext, jeweils inklusive ihrer Marken. */
export function extractDmSections(content: string): string[] {
  return findDmSections(content).map((section) => content.slice(section.start, section.end));
}

/**
 * Zerlegt den Inhalt in DM- und Nicht-DM-Abschnitte, in Dokumentreihenfolge.
 *
 * Das braucht der Renderer: er setzt jeden Abschnitt einzeln und legt nur um
 * die DM-Abschnitte den sichtbaren Kasten. Leere Abschnitte fallen weg.
 */
export function splitDmSegments(content: string): DmSegment[] {
  const sections = findDmSections(content);
  if (sections.length === 0) {
    return content ? [{ dm: false, text: content, title: null, start: 0, end: content.length }] : [];
  }

  const segments: DmSegment[] = [];
  let cursor = 0;

  const push = (dm: boolean, start: number, end: number, title: string | null) => {
    const text = content.slice(start, end);
    if (text.trim() !== "") segments.push({ dm, text, title, start, end });
  };

  for (const section of sections) {
    push(false, cursor, section.start, null);
    push(true, section.bodyStart, section.bodyEnd, section.title);
    cursor = section.end;
  }
  push(false, cursor, content.length, null);

  return segments;
}

/**
 * Rettet die DM-Bereiche eines Blocks über eine Bearbeitung hinweg, die von
 * jemandem kommt, der sie nie zu sehen bekam.
 *
 * Genau ein Fall: ein Spieler bearbeitet die Textblöcke seines eigenen
 * Charakterbogens. Er hat den geschnittenen Text bekommen; würde er ihn
 * unverändert zurückschicken, wäre die DM-Notiz gelöscht. Sie wird deshalb aus
 * dem gespeicherten Stand übernommen und hinten angehängt — die Stelle im Text
 * lässt sich nicht rekonstruieren, der Inhalt schon.
 *
 * Neue Marken aus einer solchen Eingabe werden verworfen: DM-Bereiche legt an,
 * wer sie auch lesen darf.
 */
export function preserveDmSections(previous: string, next: string): string {
  const kept = extractDmSections(previous);
  const cleaned = stripDmSections(next);
  if (kept.length === 0) return cleaned;

  return [cleaned.trimEnd(), ...kept].filter((part) => part.trim() !== "").join("\n\n");
}
