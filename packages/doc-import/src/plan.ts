/**
 * Von Dateien zum Importplan.
 *
 * Zwei Betriebsarten, weil das Material zwei Sorten hat:
 *
 * - **`wiki_pages`** — Bulk-Wiki. Eine Datei ist eine Seite, egal wie viele
 *   Überschriften darin stehen. Das ist der Fall „200 NSC-Dateien aus dem
 *   Vault einwerfen".
 * - **`document`** — ein langes Dokument wird ein Seitenbaum aus **Gegenständen**:
 *   Ebenen, Räume, NSC, Begegnungen, Handouts, Werteblöcke. Das ist der Fall
 *   „Kampagnenbuch, Dungeon, Weltkanon".
 *
 * Was `document` ausdrücklich **nicht** mehr tut: eine Seite pro Überschrift.
 * Die Überschriftentiefe ist keine Einstellung mehr, weil sie nie die richtige
 * Frage war — nicht „wie tief?", sondern „wovon handelt das?". Diese Frage
 * beantwortet `restructureDocument`, und der Rest dieses Moduls hängt nur noch
 * die Dateien aneinander.
 *
 * Beide Betriebsarten enden bei derselben Liste aus `PageDraft` und
 * `RelationDraft`, also teilen sie sich Vorschau, Schreibpfad und Rückbau.
 */

import { pickUniqueSlug, slugifyDe } from "@uwe/shared-utils/slug";
import { parseDocument, frontmatterWarnings } from "./dialect";
import { buildDocumentTree } from "./doc-tree";
import { linkEntityNames, type LinkTarget } from "./semantic/crosslink";
import { balanceDmSections } from "./semantic/dm-balance";
import { collectEntityNodes, restructureDocument } from "./semantic/restructure";
import { buildKnownEntityIndex, type KnownEntity } from "./semantic/world-context";
import { mapDocumentTree } from "./tree-mapper";
import type { DocProfile, DocumentNode, DocumentTree, PageDraft, RelationDraft, SectionRole } from "./types";

export type DocImportMode = "wiki_pages" | "document";

export interface DocImportSourceFile {
  fileName: string;
  content: string;
}

export interface BuildDocImportPlanOptions {
  mode: DocImportMode;
  profile: DocProfile;
  /** Slugs, die in der Zielwelt schon vergeben sind. */
  existingSlugs?: Iterable<string>;
  worldName?: string;
  worldSlug?: string;
  /**
   * Rollen, die die lokale KI vorgegeben hat, je Datei und Dokumentpfad.
   * Fehlen sie, entscheiden allein die Regeln — der Import läuft vollständig
   * ohne Maschinenraum-Host.
   */
  roleHints?: Map<string, Map<string, SectionRole>>;
  /**
   * Namen im Text zu Wikilinks machen. Vorgabe: an. Ausschalten heißt, den
   * Import als reinen Textabzug zu wollen.
   */
  crossLink?: boolean;
  /**
   * Die unveränderte Quelldatei als Beleg-Seite mit ablegen. Vorgabe: an im
   * Dokument-Modus. Im Bulk-Modus grundsätzlich aus — 200 Vault-Dateien würden
   * sonst 200 Beleg-Seiten erzeugen, und dort ist die Seite ohnehin die Datei.
   */
  keepSource?: boolean;
  /**
   * Was die Zielwelt schon kennt — Namen und Typen ihrer Gegenstände.
   *
   * Trägt eine Überschrift den Namen einer vorhandenen Seite, übernimmt der
   * Import deren Typ, statt am Titel zu raten. Das braucht keine KI und keinen
   * Host: Die Kenntnis liegt in derselben Datenbank, in die geschrieben wird.
   */
  knownEntities?: KnownEntity[];
}

/** Tag der abgelegten Originaldatei — daran erkennt die Leseansicht sie. */
export const DOC_IMPORT_SOURCE_TAG = "import/quelltext";

export interface DocImportStructure {
  /** Wie viele Seiten je Rolle entstehen — „8 Ebenen, 23 Räume, 11 Werteblöcke". */
  byRole: Partial<Record<SectionRole, number>>;
  /** Abschnitte, die zu Rumpftext der Seite darüber wurden. */
  folded: number;
  /** Reine Gliederungsklammern, die verschwunden sind. */
  dissolved: number;
  /** Gegenstände, die aus Fließtext herausgelöst wurden (Werteblöcke, Handouts, Räume). */
  extracted: number;
  /** Doppelt beschriebene Gegenstände, die zu einer Seite wurden. */
  merged: number;
  /** Eingefügte Wikilinks. */
  linked: number;
}

export interface DocImportPlan {
  pages: PageDraft[];
  relations: RelationDraft[];
  warnings: string[];
  /** Wie viele Seiten aus welcher Datei kommen — für die Vorschau. */
  perFile: Array<{ fileName: string; pageCount: number }>;
  structure: DocImportStructure;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * Die Originaldatei als aufklappbarer Beleg.
 *
 * Der semantische Umbau faltet, löst auf und führt zusammen — das ist der Sinn
 * der Sache, aber es heißt auch, dass niemand mehr Zeile für Zeile nachprüfen
 * kann, ob etwas untergegangen ist. Diese Seite ist die Antwort darauf: der
 * Rohtext, unverändert, eine Seite neben dem Band. Sie ist zugeklappt, trägt
 * einen eigenen Tag und bleibt aus der Leseansicht heraus.
 */
function buildSourceDraft(
  file: DocImportSourceFile,
  parentKey: string,
  key: string,
  slug: string,
  sortIndex: number,
): PageDraft {
  return {
    key,
    parentKey,
    sortIndex,
    title: `Quelltext: ${file.fileName}`,
    slug,
    type: "note",
    summary: "Die unveränderte Datei, aus der dieser Band importiert wurde.",
    canonicalStatus: "draft",
    tags: [DOC_IMPORT_SOURCE_TAG],
    aliases: [],
    html: [
      "<details>",
      `<summary>Originaldatei ${escapeHtml(file.fileName)} — unverändert</summary>`,
      `<pre><code>${escapeHtml(file.content)}</code></pre>`,
      "</details>",
    ].join("\n"),
    campaigns: [],
    seeAlso: [],
    metadata: { source: "doc-import", role: "source", sourceFile: file.fileName },
    warnings: [],
  };
}

/** `pellar-hopsenried.md` → `pellar hopsenried`, als letzter Notnagel für den Titel. */
function titleFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Ohne Titel";
}

interface PreparedFile {
  file: DocImportSourceFile;
  tree: DocumentTree;
  frontmatter: ReturnType<typeof parseDocument>["frontmatter"];
}

function emptyStructure(): DocImportStructure {
  return { byRole: {}, folded: 0, dissolved: 0, extracted: 0, merged: 0, linked: 0 };
}

/** Zählt die Wikilinks eines Rumpfs — Grundlage für „so viele wurden verknüpft". */
function countWikiLinks(markdown: string): number {
  return (markdown.match(/\[\[[^\]]+\]\]/g) ?? []).length;
}

function applyCrossLinks(nodes: DocumentNode[], targets: LinkTarget[]): number {
  let added = 0;

  const walk = (list: DocumentNode[]) => {
    for (const node of list) {
      if (node.body.trim()) {
        const before = countWikiLinks(node.body);
        node.body = linkEntityNames(node.body, targets, node.title);
        added += countWikiLinks(node.body) - before;
      }
      walk(node.children);
    }
  };

  walk(nodes);
  return added;
}

export function buildDocImportPlan(
  files: DocImportSourceFile[],
  options: BuildDocImportPlanOptions,
): DocImportPlan {
  const singlePage = options.mode === "wiki_pages";

  const pages: PageDraft[] = [];
  const relations: RelationDraft[] = [];
  const warnings: string[] = [];
  const perFile: DocImportPlan["perFile"] = [];
  const structure = emptyStructure();

  // Slugs sind pro Welt eindeutig, nicht pro Datei — die Menge wächst über den
  // ganzen Lauf mit, sonst kollidieren zwei Dateien mit gleicher Überschrift.
  const takenSlugs = new Set(options.existingSlugs ?? []);
  // Die Entwurfsschlüssel müssen über alle Dateien eindeutig bleiben, weil
  // Eltern-Kind-Beziehungen und Kanten darüber aufgelöst werden.
  let keyOffset = 0;

  // Erster Durchgang: Bäume bauen und umstellen. Erst wenn **alle** Dateien
  // gelesen sind, stehen die Namen fest, auf die verlinkt werden kann — ein
  // Kampagnenordner verweist quer über die Dateigrenze.
  const prepared: PreparedFile[] = [];
  const targets: LinkTarget[] = [];
  const knownEntities = options.knownEntities?.length
    ? buildKnownEntityIndex(options.knownEntities)
    : undefined;

  // Die Welt kennt Namen, die dieses Dokument nur erwähnt. Auch die sollen
  // klickbar werden — sonst verlinkt der Import nur auf sich selbst.
  for (const entity of options.knownEntities ?? []) {
    targets.push({ title: entity.title, aliases: entity.aliases ?? [] });
  }

  for (const file of files) {
    const parsed = parseDocument(file.content);

    if (singlePage) {
      prepared.push({ file, tree: buildDocumentTree(parsed.body, { maxDepth: 1 }), frontmatter: parsed.frontmatter });
      continue;
    }

    // Volle Tiefe: Welche Überschrift eine Seite wird, entscheidet danach die
    // Rolle — nicht die Ebene, auf der sie zufällig steht.
    const raw = buildDocumentTree(parsed.body, { maxDepth: 6 });
    const restructured = restructureDocument(raw, {
      profile: options.profile,
      roleHints: options.roleHints?.get(file.fileName),
      knownEntities,
    });

    structure.folded += restructured.stats.folded;
    structure.dissolved += restructured.stats.dissolved;
    structure.extracted += restructured.stats.extracted;
    structure.merged += restructured.stats.merged;
    for (const [role, count] of Object.entries(restructured.stats.byRole)) {
      const key = role as SectionRole;
      structure.byRole[key] = (structure.byRole[key] ?? 0) + (count ?? 0);
    }

    for (const node of collectEntityNodes(restructured.tree.nodes)) {
      targets.push({ title: node.title, aliases: node.aliases ?? [] });
    }

    prepared.push({ file, tree: restructured.tree, frontmatter: parsed.frontmatter });
  }

  if (!singlePage && options.crossLink !== false && targets.length > 0) {
    for (const entry of prepared) {
      structure.linked += applyCrossLinks(entry.tree.nodes, targets);
    }
  }

  for (const { file, tree, frontmatter } of prepared) {
    const mapped = mapDocumentTree(tree, {
      profile: options.profile,
      frontmatter,
      fallbackTitle: titleFromFileName(file.fileName),
      existingSlugs: takenSlugs,
      sourceFile: file.fileName,
      mergeRoots: singlePage ? "body" : "children",
    });

    const rekey = (key: string) => `f${keyOffset}-${key}`;

    // Ein `:::dm` im Quelltext kennt die Seitengrenzen nicht, die hier gerade
    // entstanden sind. Ohne diesen Ausgleich bekäme die Seite mit der öffnenden
    // Marke einen fail-closed abgeschnittenen Rest, und alle Seiten dahinter
    // stünden ganz ohne Marke offen — siehe `semantic/dm-balance.ts`.
    const balancedPages = singlePage ? mapped.pages : balanceDmSections(mapped.pages).pages;

    for (const page of balancedPages) {
      takenSlugs.add(page.slug);
      pages.push({
        ...page,
        key: rekey(page.key),
        parentKey: page.parentKey ? rekey(page.parentKey) : null,
      });
    }

    for (const relation of mapped.relations) {
      relations.push({ ...relation, sourceKey: rekey(relation.sourceKey) });
    }

    for (const warning of mapped.warnings) {
      warnings.push(`${file.fileName}: ${warning}`);
    }
    for (const warning of frontmatterWarnings(frontmatter, {
      worldName: options.worldName,
      worldSlug: options.worldSlug,
    })) {
      warnings.push(`${file.fileName}: ${warning}`);
    }

    if (singlePage && mapped.pages.length !== 1) {
      warnings.push(
        `${file.fileName}: erwartet wurde genau eine Seite, entstanden sind ${mapped.pages.length}.`,
      );
    }

    const keepSource = !singlePage && options.keepSource !== false;
    const rootDraft = mapped.pages[0];

    if (keepSource && rootDraft) {
      const sourceSlug = pickUniqueSlug(
        `${slugifyDe(rootDraft.slug, { fallback: "band" })}-quelltext`,
        takenSlugs,
        { fallback: "quelltext", maxLength: 80 },
      );
      takenSlugs.add(sourceSlug);

      pages.push(
        buildSourceDraft(
          file,
          rekey(rootDraft.key),
          rekey("source"),
          sourceSlug,
          mapped.pages.filter((page) => page.parentKey === rootDraft.key).length,
        ),
      );
    }

    perFile.push({
      fileName: file.fileName,
      pageCount: mapped.pages.length + (keepSource && rootDraft ? 1 : 0),
    });
    keyOffset += 1;
  }

  return { pages, relations, warnings, perFile, structure };
}
