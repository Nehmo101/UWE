/**
 * Von Dateien zum Importplan.
 *
 * Zwei Betriebsarten, weil das Material zwei Sorten hat:
 *
 * - **`wiki_pages`** — Bulk-Wiki. Eine Datei ist eine Seite, egal wie viele
 *   Überschriften darin stehen. Das ist der Fall „200 NSC-Dateien aus dem
 *   Vault einwerfen".
 * - **`document`** — ein langes Dokument wird ein Seitenbaum. Das ist der Fall
 *   „Kampagnenbuch, Dungeon, Weltkanon".
 *
 * Beide enden bei derselben Liste aus `PageDraft` und `RelationDraft`, also
 * teilen sie sich Vorschau, Schreibpfad und Rückbau.
 */

import { parseDocument, frontmatterWarnings } from "./dialect";
import { buildDocumentTree } from "./doc-tree";
import { mapDocumentTree } from "./tree-mapper";
import type { DocProfile, PageDraft, RelationDraft } from "./types";

export type DocImportMode = "wiki_pages" | "document";

export interface DocImportSourceFile {
  fileName: string;
  content: string;
}

export interface BuildDocImportPlanOptions {
  mode: DocImportMode;
  profile: DocProfile;
  /** Nur für `document`: bis zu welcher Überschriftenebene eigene Seiten entstehen. */
  maxDepth?: number;
  /** Slugs, die in der Zielwelt schon vergeben sind. */
  existingSlugs?: Iterable<string>;
  worldName?: string;
  worldSlug?: string;
}

export interface DocImportPlan {
  pages: PageDraft[];
  relations: RelationDraft[];
  warnings: string[];
  /** Wie viele Seiten aus welcher Datei kommen — für die Vorschau. */
  perFile: Array<{ fileName: string; pageCount: number }>;
}

/** `pellar-hopsenried.md` → `pellar hopsenried`, als letzter Notnagel für den Titel. */
function titleFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Ohne Titel";
}

export function buildDocImportPlan(
  files: DocImportSourceFile[],
  options: BuildDocImportPlanOptions,
): DocImportPlan {
  const singlePage = options.mode === "wiki_pages";
  const maxDepth = singlePage ? 1 : (options.maxDepth ?? 3);

  const pages: PageDraft[] = [];
  const relations: RelationDraft[] = [];
  const warnings: string[] = [];
  const perFile: DocImportPlan["perFile"] = [];

  // Slugs sind pro Welt eindeutig, nicht pro Datei — die Menge wächst über den
  // ganzen Lauf mit, sonst kollidieren zwei Dateien mit gleicher Überschrift.
  const takenSlugs = new Set(options.existingSlugs ?? []);
  // Die Entwurfsschlüssel müssen über alle Dateien eindeutig bleiben, weil
  // Eltern-Kind-Beziehungen und Kanten darüber aufgelöst werden.
  let keyOffset = 0;

  for (const file of files) {
    const parsed = parseDocument(file.content);
    const tree = buildDocumentTree(parsed.body, { maxDepth });

    const mapped = mapDocumentTree(tree, {
      profile: options.profile,
      frontmatter: parsed.frontmatter,
      fallbackTitle: titleFromFileName(file.fileName),
      existingSlugs: takenSlugs,
      sourceFile: file.fileName,
      mergeRoots: singlePage ? "body" : "children",
    });

    const rekey = (key: string) => `f${keyOffset}-${key}`;

    for (const page of mapped.pages) {
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
    for (const warning of frontmatterWarnings(parsed.frontmatter, {
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

    perFile.push({ fileName: file.fileName, pageCount: mapped.pages.length });
    keyOffset += 1;
  }

  return { pages, relations, warnings, perFile };
}
