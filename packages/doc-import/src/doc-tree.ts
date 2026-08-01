/**
 * Ein Markdown-Dokument in seinen Überschriftenbaum zerlegen.
 *
 * Das ist der Kern des Dokument-Imports. Ein Kampagnenbuch ist kein Wiki-Eintrag
 * und auch kein Haufen Wiki-Einträge — es ist ein Text mit Lesereihenfolge. UWE
 * kann das seit je abbilden (`Page.parentPageId`), es hat nur nie jemand befüllt.
 *
 *     # Himmelsrouten          → Wurzelseite
 *     ## Kapitel 1             → Kind, sortIndex 0
 *     ### 1.1 Worum es geht    → Enkel, sortIndex 0
 *     ### 1.2 Die drei Akte    → Enkel, sortIndex 1
 *     ## Kapitel 2             → Kind, sortIndex 1
 *
 * `maxDepth` entscheidet, wo das Zerlegen aufhört: Alles darunter bleibt als
 * Markdown im Rumpf der letzten erzeugten Seite stehen. Eine Szene will man als
 * eigene Seite; die vier Absätze darin nicht.
 */

import { stripCanonMarkers } from "./canonical-status";
import type { DocumentNode, DocumentTree } from "./types";

const HEADING = /^(#{1,6})[ \t]+(.*\S)[ \t]*$/;
const FENCE = /^(?:```|~~~)/;
const HORIZONTAL_RULE = /^(?:-{3,}|\*{3,}|_{3,})$/;

export interface BuildDocumentTreeOptions {
  /** Bis zu welcher Überschriftenebene eigene Knoten entstehen. Vorgabe: 3. */
  maxDepth?: number;
  /**
   * Untertitelzeilen unter der ersten Überschrift in die Wurzelseite ziehen,
   * statt eigene Seiten daraus zu machen. Vorgabe: an.
   */
  foldTitleBlock?: boolean;
  /** Inhaltsverzeichnisse überspringen — im Wiki ist die Navigation der Baum. Vorgabe: an. */
  skipTableOfContents?: boolean;
}

/** „INHALT", „INHALTSVERZEICHNIS", „Contents" — im Wiki überflüssig. */
const TABLE_OF_CONTENTS =
  /^(inhalt|inhaltsverzeichnis|contents|table of contents|index|übersicht der kapitel)$/i;

interface RawSection {
  level: number;
  rawTitle: string;
  lines: string[];
}

/**
 * Trennt das Dokument an Überschriften. Code-Zäune werden respektiert — ein `#`
 * in einem Codeblock ist ein Kommentar, keine Überschrift.
 */
function collectSections(markdown: string): { preamble: string[]; sections: RawSection[] } {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const preamble: string[] = [];
  const sections: RawSection[] = [];
  let current: RawSection | null = null;
  let inFence = false;

  for (const line of lines) {
    if (FENCE.test(line.trim())) {
      inFence = !inFence;
    }

    const heading = inFence ? null : HEADING.exec(line);

    if (heading) {
      current = { level: heading[1].length, rawTitle: heading[2], lines: [] };
      sections.push(current);
      continue;
    }

    (current ? current.lines : preamble).push(line);
  }

  return { preamble, sections };
}

/** Führende und abschließende Trennlinien und Leerzeilen weg. */
function trimBody(lines: string[]): string {
  const copy = [...lines];

  const isNoise = (line: string) => {
    const trimmed = line.trim();
    return trimmed === "" || HORIZONTAL_RULE.test(trimmed);
  };

  while (copy.length > 0 && isNoise(copy[0])) copy.shift();
  while (copy.length > 0 && isNoise(copy[copy.length - 1])) copy.pop();

  return copy.join("\n");
}

/**
 * Verschiebt die Überschriften eines Seitenrumpfs so, dass die flachste zu `##`
 * wird. Der Seitentitel ist die `#`-Ebene der Seite; ein Rumpf, der mit `####`
 * anfängt, sähe sonst aus wie Kleingedrucktes.
 */
export function normalizeBodyHeadings(body: string): string {
  const lines = body.split("\n");
  let inFence = false;
  let minLevel = 7;

  for (const line of lines) {
    if (FENCE.test(line.trim())) inFence = !inFence;
    if (inFence) continue;
    const heading = HEADING.exec(line);
    if (heading) minLevel = Math.min(minLevel, heading[1].length);
  }

  if (minLevel > 6 || minLevel === 2) return body;

  const shift = 2 - minLevel;
  inFence = false;

  return lines
    .map((line) => {
      if (FENCE.test(line.trim())) inFence = !inFence;
      if (inFence) return line;

      const heading = HEADING.exec(line);
      if (!heading) return line;

      const level = Math.min(6, Math.max(1, heading[1].length + shift));
      return `${"#".repeat(level)} ${heading[2]}`;
    })
    .join("\n");
}

/** Stellt eine gefaltete Überschrift als Markdown wieder her. */
function headingLine(section: RawSection): string {
  return `${"#".repeat(section.level)} ${section.rawTitle}`;
}

/**
 * Zieht den Titelblock in die Wurzelseite.
 *
 * Lasses Dokumente beginnen alle gleich: eine `#`-Zeile mit dem Namen, darunter
 * ein bis drei Untertitelzeilen als eigene Überschriften.
 *
 *     # DER MAGISTER-TURM VON VALIDORI
 *     ### Ein Dungeon für FTKJ · Stufe 8 · 4 Charaktere · D&D 5e
 *     ### Arkaner Seuchenturm auf einer Wurzelplattform · 3–5 Sitzungen
 *
 * Ohne diesen Schritt entstünden daraus zwei leere Wiki-Seiten — und weil in der
 * zweiten „Wurzelplattform" steht, sogar eine vom Typ „Ort".
 *
 * Die Regel ist bewusst eng: **nur führende Kinder ohne eigenen Text und ohne
 * eigene Kinder** sind Untertitel. Alles andere könnte ein echter Abschnitt sein,
 * und eine Überschrift zu verschlucken, die jemand als Abschnitt gemeint hat, ist
 * schlimmer als eine Wurzelseite, die nur ihre Kinder auflistet.
 */
function foldTitleBlock(root: DocumentNode): void {
  const subtitles: string[] = [];

  while (root.children.length > 0) {
    const first = root.children[0];
    if (first.body.trim() || first.children.length > 0) break;
    subtitles.push(first.title);
    root.children.shift();
  }

  if (subtitles.length === 0) return;

  const block = subtitles.map((line) => `**${line}**`).join("\n\n");
  root.body = root.body.trim() ? `${block}\n\n${root.body}` : block;

  root.children.forEach((child, index) => {
    child.sortIndex = index;
  });
}

/** Entfernt Inhaltsverzeichnis-Knoten (nur solche ohne eigene Unterseiten). */
function dropTableOfContents(nodes: DocumentNode[]): DocumentNode[] {
  const kept = nodes.filter(
    (node) => !(TABLE_OF_CONTENTS.test(node.title.trim()) && node.children.length === 0),
  );

  for (const node of kept) {
    node.children = dropTableOfContents(node.children);
  }

  kept.forEach((node, index) => {
    node.sortIndex = index;
  });

  return kept;
}

/**
 * Baut den Baum.
 *
 * Ebenensprünge (`#` direkt gefolgt von `###`) sind kein Fehler: der Stapel
 * hängt den tieferen Abschnitt einfach an den nächstgelegenen flacheren an.
 * Dokumente werden von Menschen geschrieben, nicht von Parsern.
 */
export function buildDocumentTree(
  markdown: string,
  options: BuildDocumentTreeOptions = {},
): DocumentTree {
  const maxDepth = Math.min(6, Math.max(1, options.maxDepth ?? 3));
  const { preamble, sections } = collectSections(markdown);

  const roots: DocumentNode[] = [];
  /** Offene Knoten von flach nach tief. */
  const stack: DocumentNode[] = [];
  /** Rohzeilen des jeweils offenen Knotens, inklusive eingefalteter Unterabschnitte. */
  const bodies = new Map<DocumentNode, string[]>();

  for (const section of sections) {
    // Zu tief zum Aufteilen: zurück in den Rumpf des offenen Knotens.
    if (section.level > maxDepth && stack.length > 0) {
      const host = stack[stack.length - 1];
      const hostLines = bodies.get(host);
      if (hostLines) {
        hostLines.push("", headingLine(section), ...section.lines);
        continue;
      }
    }

    while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1] ?? null;
    const siblings = parent ? parent.children : roots;
    const { title, marker } = stripCanonMarkers(section.rawTitle);

    const node: DocumentNode = {
      level: section.level,
      title: title || section.rawTitle.trim(),
      body: "",
      marker,
      sortIndex: siblings.length,
      children: [],
    };

    siblings.push(node);
    stack.push(node);
    bodies.set(node, [...section.lines]);
  }

  for (const [node, lines] of bodies) {
    node.body = normalizeBodyHeadings(trimBody(lines));
  }

  let nodes = roots;

  if (options.skipTableOfContents !== false) {
    nodes = dropTableOfContents(nodes);
  }

  if (options.foldTitleBlock !== false && nodes.length > 0) {
    foldTitleBlock(nodes[0]);
  }

  return { preamble: trimBody(preamble), nodes };
}

/** Alle Knoten in Dokumentreihenfolge — Elternteil vor seinen Kindern. */
export function flattenTree(nodes: DocumentNode[]): DocumentNode[] {
  const out: DocumentNode[] = [];

  const walk = (list: DocumentNode[]) => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };

  walk(nodes);
  return out;
}

/** Anzahl der Knoten — für „so viele Seiten entstehen" in der Vorschau. */
export function countNodes(nodes: DocumentNode[]): number {
  return flattenTree(nodes).length;
}
