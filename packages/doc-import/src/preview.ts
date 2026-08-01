/**
 * Import-Vorschau: was würde passieren, wenn ich jetzt auf „Übernehmen" drücke.
 *
 * Rein — der Aufrufer reicht den Seitenindex der Welt herein. Damit lässt sich
 * die Vorschau ohne Datenbank testen und im Job-Payload ablegen.
 */

import { normalizeLookupKey } from "@uwe/shared-utils/slug";
import { auditWikiLinks } from "./relations";
import type { PageDraft, RelationDraft } from "./types";

export type DocImportItemStatus = "new" | "conflict" | "duplicate";

export interface ExistingPageRef {
  id: string;
  title: string;
  slug: string;
  aliases?: string[];
}

export interface DocImportItem {
  key: string;
  parentKey: string | null;
  depth: number;
  title: string;
  slug: string;
  type: string;
  canonicalStatus: string | null;
  status: DocImportItemStatus;
  /** Die Seite, mit der dieser Entwurf kollidiert. */
  existingPageId?: string;
  tags: string[];
  warnings: string[];
}

export interface DocImportPreview {
  items: DocImportItem[];
  summary: Record<DocImportItemStatus, number>;
  /** Kampagnennamen aus dem Frontmatter, die es in der Welt nicht gibt. */
  unknownCampaigns: string[];
  /** Wikilink-Ziele, die nach dem Import weiterhin ins Leere zeigen. */
  unresolvedLinks: string[];
  warnings: string[];
  canExecute: boolean;
}

export interface BuildDocImportPreviewOptions {
  existingPages: ExistingPageRef[];
  /** Slugs der Kampagnen der Zielwelt, für die Namensauflösung. */
  campaignNames?: string[];
  warnings?: string[];
}

function lookupKeysOf(page: ExistingPageRef): string[] {
  return [page.title, page.slug, ...(page.aliases ?? [])].map(normalizeLookupKey);
}

/**
 * Baut die Vorschau.
 *
 * `duplicate` heißt „ein Entwurf trägt den Titel einer bestehenden Seite" —
 * das ist beim erneuten Import desselben Dokuments der Normalfall und deshalb
 * nur ein Hinweis, kein Fehler. `conflict` heißt „der Slug ist vergeben"; der
 * Schreibpfad hängt dann eine Nummer an.
 */
export function buildDocImportPreview(
  drafts: PageDraft[],
  relations: RelationDraft[],
  options: BuildDocImportPreviewOptions,
): DocImportPreview {
  const slugToPage = new Map(options.existingPages.map((page) => [page.slug, page]));
  const titleToPage = new Map<string, ExistingPageRef>();
  for (const page of options.existingPages) {
    titleToPage.set(normalizeLookupKey(page.title), page);
  }

  const depthByKey = new Map<string, number>();
  const items: DocImportItem[] = [];
  const summary: Record<DocImportItemStatus, number> = { new: 0, conflict: 0, duplicate: 0 };

  for (const draft of drafts) {
    const depth = draft.parentKey ? (depthByKey.get(draft.parentKey) ?? 0) + 1 : 0;
    depthByKey.set(draft.key, depth);

    const slugClash = slugToPage.get(draft.slug);
    const titleClash = titleToPage.get(normalizeLookupKey(draft.title));

    const status: DocImportItemStatus = slugClash ? "conflict" : titleClash ? "duplicate" : "new";
    summary[status] += 1;

    items.push({
      key: draft.key,
      parentKey: draft.parentKey,
      depth,
      title: draft.title,
      slug: draft.slug,
      type: draft.type,
      canonicalStatus: draft.canonicalStatus,
      status,
      existingPageId: (slugClash ?? titleClash)?.id,
      tags: draft.tags,
      warnings: draft.warnings,
    });
  }

  const knownCampaigns = new Set((options.campaignNames ?? []).map(normalizeLookupKey));
  const unknownCampaigns = [
    ...new Set(
      drafts
        .flatMap((draft) => draft.campaigns)
        .filter((name) => !knownCampaigns.has(normalizeLookupKey(name))),
    ),
  ];

  // Nach dem Import gibt es die neuen Seiten — Selbstverweise gelten also nicht als tot.
  const afterImport = [
    ...options.existingPages.flatMap(lookupKeysOf),
    ...drafts.flatMap((draft) => [draft.title, draft.slug].map(normalizeLookupKey)),
  ];

  const linkAudit = auditWikiLinks(
    drafts.map((draft) => draft.html),
    afterImport,
  );

  const relationAudit = auditWikiLinks(
    relations.map((relation) => `[[${relation.targetLookup}]]`),
    afterImport,
  );

  const warnings = [...(options.warnings ?? [])];
  if (unknownCampaigns.length > 0) {
    warnings.push(
      `Diese Kampagnen gibt es in der Welt nicht: ${unknownCampaigns.join(", ")}. Die Seiten bekommen den Tag, aber keine Kampagnen-Zuordnung.`,
    );
  }
  if (relationAudit.unresolved.length > 0) {
    warnings.push(
      `„siehe_auch" verweist auf ${relationAudit.unresolved.length} Seite(n), die es noch nicht gibt: ${relationAudit.unresolved.slice(0, 8).join(", ")}${relationAudit.unresolved.length > 8 ? " …" : ""}.`,
    );
  }

  return {
    items,
    summary,
    unknownCampaigns,
    unresolvedLinks: linkAudit.unresolved,
    warnings,
    canExecute: items.length > 0,
  };
}
