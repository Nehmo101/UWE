/**
 * Durchgang 3: falten und zusammenführen.
 *
 * Hier wird entschieden, was **keine** Seite wird. Das ist der Durchgang, der
 * den alten Import ersetzt: Er machte aus jeder Überschrift bis Ebene N eine
 * Wiki-Seite, und ein Kampagnenbuch zerfiel in 176 Fragmente, von denen 140 aus
 * zwei Sätzen bestanden. „Was man hier lernt" gehört auf die Ebene, auf der man
 * es lernt — nicht auf Seite 141.
 *
 * Und danach: Denselben Gegenstand gibt es einmal. Ein Buch beschreibt eine
 * Person dort, wo sie auftritt, und noch einmal im Werteblock-Anhang; zwei
 * Wiki-Seiten „Inquisitor Ruin" sind genau die Doppelung, die ein Wiki wertlos
 * macht.
 */

import type { DocumentNode, SectionRole } from "../types";
import type { Counters } from "./counters";
import { isPageRole } from "./roles";

/** Ab dieser Rumpflänge lohnt eine eigene Seite auch ohne Gegenstandsrolle. */
const STANDALONE_BODY_LENGTH = 1_400;

const HEADING = /^(#{1,6})(\s+)(.*)$/;
const FENCE = /^(?:```|~~~)/;

/** Verschiebt alle Überschriften eines Rumpfs um `by` Ebenen nach unten. */
export function shiftHeadings(body: string, by: number): string {
  if (by <= 0 || !body) return body;
  let inFence = false;

  return body
    .split("\n")
    .map((line) => {
      if (FENCE.test(line.trim())) inFence = !inFence;
      if (inFence) return line;

      const match = HEADING.exec(line);
      if (!match) return line;

      return `${"#".repeat(Math.min(6, match[1].length + by))}${match[2]}${match[3]}`;
    })
    .join("\n");
}

/** Einen Knoten samt Kindern als Markdown-Abschnitt schreiben. */
function nodeToMarkdown(node: DocumentNode, level: number): string {
  const heading = `${"#".repeat(Math.min(6, level))} ${node.title}`;
  const body = shiftHeadings(node.body.trim(), Math.max(0, level - 1));
  const parts = [heading, body].filter(Boolean);

  for (const child of node.children) {
    parts.push(nodeToMarkdown(child, level + 1));
  }

  return parts.join("\n\n");
}

/**
 * Verdient dieser Knoten eine eigene Seite?
 *
 * Gegenstandsrollen immer. Alles andere nur, wenn es lang genug ist, um allein
 * zu stehen — ein Abschnitt mit 3 000 Zeichen ist auch ohne erkannte Rolle
 * etwas, das man aufschlägt; drei Sätze sind es nicht.
 */
function deservesPage(node: DocumentNode): boolean {
  if (!node.role) return true;
  if (isPageRole(node.role)) return true;

  // Wer Seiten unter sich hat, ist selbst eine. `foldNonPages` arbeitet von
  // unten nach oben, also stehen hier nur noch Kinder, die die Faltung
  // überlebt haben — ein Abschnitt mit einer NSC-Seite darunter würde beim
  // Falten seine Kinder mit in den Fließtext ziehen und sie damit verlieren.
  if (node.children.length > 0) return true;

  if (node.role === "detail") return false;

  return node.body.trim().length >= STANDALONE_BODY_LENGTH;
}

/**
 * Faltet alles, was keine Seite wird, in den Rumpf des Elternteils.
 *
 * Die Reihenfolge bleibt erhalten: Ein gefalteter Abschnitt landet an der
 * Stelle im Text, an der er im Dokument stand — sonst läse sich die Seite
 * anders als das Buch.
 */
export function foldNonPages(node: DocumentNode, counters: Counters): void {
  const kept: DocumentNode[] = [];
  const appended: string[] = [];

  for (const child of node.children) {
    foldNonPages(child, counters);

    if (deservesPage(child)) {
      kept.push(child);
      continue;
    }

    appended.push(nodeToMarkdown(child, 2));
    counters.folded += 1;
  }

  if (appended.length > 0) {
    node.body = [node.body.trim(), ...appended].filter(Boolean).join("\n\n");
  }

  node.children = kept;
  kept.forEach((child, index) => {
    child.sortIndex = index;
  });
}

/**
 * Rollen, bei denen ein gleicher Titel wirklich dieselbe Sache meint.
 *
 * Absichtlich eng: Zwei Räume „Der Gang" auf verschiedenen Ebenen sind zwei
 * Räume, und sie zusammenzuwerfen wäre schlimmer als die Doppelung, die es zu
 * vermeiden gilt.
 */
const MERGEABLE_ROLES = new Set<SectionRole>(["npc", "statblock", "item", "faction", "handout"]);

/**
 * Führt doppelt beschriebene Gegenstände zusammen.
 *
 * In Dokumentreihenfolge — der erste Fund behält seinen Platz im Baum, alles
 * Spätere wandert als Abschnitt in seinen Rumpf. Nur blattstehende Gegenstände;
 * ein Knoten mit Kindern ist eine Gliederung und wird nie stillschweigend
 * verschoben.
 */
export function mergeDuplicateEntities(root: DocumentNode, counters: Counters): void {
  const byTitle = new Map<string, DocumentNode>();
  const key = (title: string) => title.trim().toLocaleLowerCase("de");

  const walk = (node: DocumentNode) => {
    const kept: DocumentNode[] = [];

    for (const child of node.children) {
      walk(child);

      const mergeable =
        child.role && MERGEABLE_ROLES.has(child.role) && child.children.length === 0;
      if (!mergeable) {
        kept.push(child);
        continue;
      }

      const existing = byTitle.get(key(child.title));
      if (!existing) {
        byTitle.set(key(child.title), child);
        kept.push(child);
        continue;
      }

      if (child.body.trim()) {
        existing.body = [existing.body.trim(), shiftHeadings(child.body.trim(), 1)]
          .filter(Boolean)
          .join("\n\n");
      }
      existing.aliases = [...new Set([...(existing.aliases ?? []), ...(child.aliases ?? [])])];
      counters.merged += 1;
    }

    node.children = kept;
    kept.forEach((child, index) => {
      child.sortIndex = index;
    });
  };

  byTitle.set(key(root.title), root);
  walk(root);
}
