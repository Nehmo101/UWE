/**
 * Beziehungen aus einem Dokument.
 *
 * UWE führt bewusst **zwei** Graphen, und dieser Import respektiert das:
 *
 * - `PageLink`-Zeilen sind von Hand gepflegte, typisierte Beziehungen. Nur was
 *   jemand ausdrücklich hingeschrieben hat, gehört dort hinein — also
 *   `siehe_auch: [ferlor, xarza]` aus dem Frontmatter.
 * - `[[Wikilinks]]` im Fließtext bleiben Text und werden bei jedem Seitenaufruf
 *   gegen den Welt-Index aufgelöst (`page-service.ts`). Genau deshalb heilt ein
 *   heute toter Link von selbst, sobald das Ziel angelegt wird. Sie hier zu
 *   `PageLink`-Zeilen einzufrieren, würde diese Eigenschaft zerstören und den
 *   Graphen doppelt zählen lassen.
 *
 * Dieses Modul liest die Wikilinks daher nur, um in der Vorschau sagen zu können,
 * wie viele Ziele es gibt und wie viele davon (noch) ins Leere zeigen.
 */

import { decodeHtmlEntities } from "@uwe/shared-utils/html-entities";
import { normalizeLookupKey } from "@uwe/shared-utils/slug";

/**
 * `[[Ziel]]` oder `[[Ziel|Beschriftung]]`.
 *
 * Die öffnende Klammer ist in beiden Zeichenklassen ausgeschlossen. Ohne das
 * läuft ein Ziel über das nächste `[[` hinweg bis ans Textende, findet dort kein
 * `]]` und der Versuch beginnt beim nächsten `[[` von vorn — quadratisch in der
 * Zahl der Klammern. Ein Wikilink-Ziel enthält ohnehin nie eine `[`.
 *
 * Dieselbe Klasse steht in `markdown-html.ts`, wo die Klammern für die
 * Zusammenfassung entfernt werden. Wer eine ändert, ändert beide.
 */
const WIKILINK = /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g;

/** Alle Wikilink-Ziele eines Textes, in Dokumentreihenfolge, ohne Dubletten. */
export function collectWikiLinkTargets(text: string): string[] {
  const seen = new Set<string>();
  const targets: string[] = [];

  WIKILINK.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WIKILINK.exec(text)) !== null) {
    // Der Text kommt hier bereits als HTML an: `[[A'Tuin]]` steht darin als
    // `[[A&#39;Tuin]]`. Ohne Rückübersetzung meldet die Vorschau ein totes Ziel,
    // das in Wirklichkeit auflöst — siehe `decodeHtmlEntities`.
    const target = decodeHtmlEntities(match[1]?.trim() ?? "");
    if (!target) continue;

    const key = normalizeLookupKey(target);
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(target);
  }

  return targets;
}

export interface LinkAudit {
  /** Alle im Dokument gefundenen Wikilink-Ziele. */
  targets: string[];
  /** Ziele, die weder in der Welt noch im Import selbst vorkommen. */
  unresolved: string[];
}

/**
 * Prüft die Wikilinks eines Imports gegen das, was danach in der Welt steht:
 * die bestehenden Seiten **plus** die gerade erst angelegten. Ein Dokument, das
 * sich selbst verlinkt, soll nicht als kaputt gemeldet werden.
 */
export function auditWikiLinks(
  texts: Iterable<string>,
  knownLookups: Iterable<string>,
): LinkAudit {
  const known = new Set([...knownLookups].map(normalizeLookupKey));
  const seen = new Set<string>();
  const targets: string[] = [];
  const unresolved: string[] = [];

  for (const text of texts) {
    for (const target of collectWikiLinkTargets(text)) {
      const key = normalizeLookupKey(target);
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push(target);
      if (!known.has(key)) unresolved.push(target);
    }
  }

  return { targets, unresolved };
}
