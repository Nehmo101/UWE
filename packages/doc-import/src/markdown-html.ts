/**
 * Markdown → HTML für den Import.
 *
 * **Warum das hier nötig ist.** UWEs Laufzeit-Renderer (`renderContentHtml` in
 * `page-service.ts`) kann von Markdown nur Überschriften, Listen und Absätze.
 * Keine Tabellen, kein Fett, keine Blockzitate. Genau daraus besteht Lasses
 * Material aber: `| Stunde | Was geschah |`, `**Rumpf** 75 TP`, `> Vorlesen:`.
 *
 * Statt den Laufzeit-Renderer umzubauen — und damit jede Bestandsseite anzufassen —
 * wird **einmal beim Import** konvertiert. `renderContentHtml` erkennt HTML an
 * seiner Heuristik (`looksLikeHtml`), löst die `[[Wikilinks]]` an ihren Offsets
 * darin auf und schickt das Ergebnis durch `sanitizeWikiHtml`. Der Weg ist also
 * bereits vorgesehen; er wurde nur nie befüllt.
 *
 * **`[[…]]` bleibt stehen.** Doppelte eckige Klammern sind keine Markdown-Syntax,
 * also reicht `marked` sie unverändert als Text durch — auch in Tabellenzellen.
 * Die Auflösung passiert weiterhin zur Laufzeit gegen den Welt-Index, damit ein
 * später angelegtes Ziel einen vorher toten Link von selbst heilt.
 *
 * **Sanitisierung** passiert bewusst nicht hier: dafür braucht es DOMPurify/jsdom,
 * und dieses Package bleibt rein. Wer das Ergebnis speichert, schickt es vorher
 * durch `sanitizeWikiHtml` aus `@uwe/database`; beim Rendern greift derselbe
 * Filter ohnehin noch einmal.
 */

import { Marked } from "marked";
import { slugifyDe } from "@uwe/shared-utils/slug";

const marked = new Marked({
  gfm: true,
  // Ein einzelner Zeilenumbruch ist in diesen Dokumenten Umbruch aus Bequemlichkeit,
  // kein gewollter <br>. Absätze werden über Leerzeilen gemacht.
  breaks: false,
});

const HEADING_OPEN = /<(h[1-6])>/g;

/**
 * Markup aus einem HTML-Schnipsel nehmen — nur, um daraus einen Slug zu bauen.
 *
 * Bewusst **kein** `replace(/<[^>]*>/g, "")`. Das ist zweierlei Ärger in einer
 * Zeile: Es frisst über die nächste spitze Klammer hinweg bis zum Textende und
 * setzt an jeder Startstelle neu zurück — quadratisch. Und ein einzelner
 * Durchlauf über ein mehrzeichiges Muster ist als Entferner grundsätzlich
 * unvollständig: was er stehen lässt, kann zusammenwachsen, wonach er gesucht
 * hat. Ein Durchlauf Zeichen für Zeichen kann beides nicht.
 *
 * Eine spitze Klammer ohne Gegenstück gilt als Text, nicht als angefangenes Tag
 * — sonst verschluckte ein „a < b" den Rest der Überschrift.
 */
function stripTags(html: string): string {
  let out = "";
  let index = 0;

  while (index < html.length) {
    const open = html.indexOf("<", index);
    if (open < 0) return out + html.slice(index);

    out += html.slice(index, open);

    const close = html.indexOf(">", open + 1);
    if (close < 0) return out + html.slice(open);

    index = close + 1;
  }

  return out;
}

/**
 * Gibt Überschriften stabile `id`s, damit der Session-Runner an eine Stelle
 * springen und ein Lesezeichen sie wiederfinden kann. Doppelte Titel bekommen
 * einen Zähler, sonst führte „Auf einen Blick" (in Himmelsrouten neunmal) alle
 * auf dieselbe Marke.
 *
 * Das schließende Tag wird mit `indexOf` gesucht statt mit einer Regex über den
 * ganzen Block (`<(h[1-6])>([\s\S]*?)<\/\1>`): die suchte bei jedem **nicht**
 * geschlossenen `<h1>` bis ans Textende und begann beim nächsten von vorn. Ein
 * roher HTML-Schnipsel im importierten Markdown reicht, um das auszulösen.
 */
function addHeadingIds(html: string): string {
  const used = new Map<string, number>();
  /** Tags, für die es hinter der aktuellen Stelle kein schließendes mehr gibt. */
  const unclosed = new Set<string>();

  let out = "";
  let cursor = 0;

  for (const match of html.matchAll(HEADING_OPEN)) {
    const start = match.index ?? -1;
    if (start < cursor) continue;

    const tag = match[1];
    if (unclosed.has(tag)) continue;

    const closing = `</${tag}>`;
    const innerStart = start + match[0].length;
    const innerEnd = html.indexOf(closing, innerStart);
    if (innerEnd < 0) {
      // Weiter hinten kann erst recht keines mehr kommen — nicht noch einmal suchen.
      unclosed.add(tag);
      continue;
    }

    const inner = html.slice(innerStart, innerEnd);
    const after = innerEnd + closing.length;
    const base = slugifyDe(stripTags(inner).trim(), { maxLength: 60 });

    out += html.slice(cursor, start);

    if (base) {
      const seen = used.get(base) ?? 0;
      used.set(base, seen + 1);
      const id = seen === 0 ? base : `${base}-${seen + 1}`;
      out += `<${tag} id="${id}">${inner}${closing}`;
    } else {
      out += html.slice(start, after);
    }

    cursor = after;
  }

  return out + html.slice(cursor);
}

/**
 * Wandelt Markdown in HTML um, das `renderContentHtml` als HTML erkennt.
 *
 * Leerer oder reiner Whitespace-Eingang gibt einen leeren String zurück — der
 * Aufrufer legt dann keinen Block an, statt einen leeren zu speichern.
 */
export function markdownToWikiHtml(markdown: string): string {
  const trimmed = markdown?.trim();
  if (!trimmed) return "";

  const html = marked.parse(trimmed, { async: false });

  return addHeadingIds(typeof html === "string" ? html.trim() : "");
}

/**
 * Plattext aus Markdown — für `Page.summary`, wo Markup nur stört.
 *
 * Nimmt den ersten echten Absatz und kürzt ihn. Überschriften, Zitatzeichen,
 * Tabellen und Listenpunkte werden übersprungen: eine Zusammenfassung, die mit
 * „| Stunde | Was geschah |" beginnt, hilft niemandem.
 */
export function markdownToSummary(markdown: string, maxLength = 240): string | null {
  const lines = (markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
  const collected: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (collected.length > 0) break;
      continue;
    }
    if (
      trimmed.startsWith("#") ||
      trimmed.startsWith("|") ||
      trimmed.startsWith(">") ||
      trimmed.startsWith("- ") ||
      trimmed.startsWith("* ") ||
      trimmed.startsWith("```") ||
      /^-{3,}$/.test(trimmed) ||
      /^\d+\.\s/.test(trimmed)
    ) {
      if (collected.length > 0) break;
      continue;
    }

    collected.push(trimmed);
  }

  if (collected.length === 0) return null;

  const text = collected
    .join(" ")
    // `[` in beiden Klassen ausgeschlossen — Begründung in `relations.ts`.
    .replace(/\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g, (_match, target: string, label?: string) =>
      (label ?? target).trim(),
    )
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!text) return null;
  if (text.length <= maxLength) return text;

  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
