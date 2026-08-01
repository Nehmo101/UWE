/**
 * Seiten aus einer Welt in eine andere übernehmen.
 *
 * Der Anlass ist fremdes Material: ein gekaufter Kampagnenband landet zuerst in
 * einer Werkstatt-Welt ohne Spieler-Zuordnung, wird dort in Ruhe gesichtet, und
 * nur die Teile, die man wirklich etablieren will, wandern in die eigene Welt.
 * Das ist in UWE die einzige Trennlinie, die es dafür gibt — Sichtbarkeit hängt
 * seit dem 26.07.2026 allein an der Welt-Zuordnung, nicht mehr am Einzelinhalt.
 *
 * Kopiert wird ein **Teilbaum**, nicht eine Liste: Eltern vor Kindern, damit
 * `parentPageId` und `sortIndex` in der Zielwelt dieselbe Ordnung ergeben.
 * Slugs werden gegen die Zielwelt neu vergeben (`@@unique([worldId, slug])`).
 *
 * Was **nicht** mitkommt: Assets, `PageLink`-Kanten und Kampagnen-Zuordnungen
 * der Quellwelt. Kanten zeigen auf Seiten-IDs, die in der Zielwelt nichts
 * bedeuten; das stillschweigend umzubiegen wäre geraten, nicht übernommen.
 * `[[Wikilinks]]` reisen als Text mit und lösen sich in der Zielwelt neu auf —
 * die Vorschau sagt vorher, welche davon dort ins Leere zeigen werden.
 */

import type { PageWithBlocks, Prisma, UweRepository } from "@uwe/database/server";
import { pickUniqueSlug } from "@uwe/shared-utils/slug";
import { auditWikiLinks } from "./relations";

export interface TransferPagesOptions {
  sourceWorldSlug: string;
  targetWorldSlug: string;
  /** Die ausgewählten Seiten. */
  pageIds: string[];
  /** Unterseiten automatisch mitnehmen. Vorgabe: ja. */
  includeDescendants?: boolean;
  /** Kampagne in der Zielwelt, der alles zugeordnet wird. */
  targetCampaignId?: string | null;
}

export interface TransferPreviewItem {
  sourcePageId: string;
  title: string;
  type: string;
  /** Slug, den die Seite in der Zielwelt bekommen würde. */
  slug: string;
  /** Wurde die Seite nur wegen `includeDescendants` mitgenommen? */
  implicit: boolean;
  depth: number;
}

export interface TransferPreview {
  items: TransferPreviewItem[];
  /** Wikilink-Ziele, die es in der Zielwelt danach immer noch nicht gibt. */
  danglingLinks: string[];
  warnings: string[];
}

export interface TransferPagesResult {
  created: number;
  failed: number;
  pages: Array<{ sourcePageId: string; pageId: string; slug: string }>;
  danglingLinks: string[];
  warnings: string[];
  undo: { createdPageIds: string[] };
}

interface TransferPlan {
  ordered: Array<{ page: PageWithBlocks; implicit: boolean; depth: number }>;
  slugByPageId: Map<string, string>;
  danglingLinks: string[];
  warnings: string[];
}

function blockContent(page: PageWithBlocks): string {
  return page.contentBlocks.map((block) => block.content).join("\n\n");
}

/**
 * Bringt die Auswahl in Kopierreihenfolge und vergibt die Zielslugs.
 *
 * Eine Seite, deren Elternteil nicht mitkommt, wird in der Zielwelt zur Wurzel —
 * das ist die einzige ehrliche Auflösung und wird als Warnung gemeldet.
 */
function buildTransferPlan(
  sourcePages: PageWithBlocks[],
  targetPages: Array<{ title: string; slug: string; aliases?: unknown }>,
  options: TransferPagesOptions,
): TransferPlan {
  const byId = new Map(sourcePages.map((page) => [page.id, page]));
  const selected = new Set(options.pageIds.filter((id) => byId.has(id)));
  const explicit = new Set(selected);

  if (options.includeDescendants !== false) {
    const childrenByParent = new Map<string, string[]>();
    for (const page of sourcePages) {
      if (!page.parentPageId) continue;
      const siblings = childrenByParent.get(page.parentPageId) ?? [];
      siblings.push(page.id);
      childrenByParent.set(page.parentPageId, siblings);
    }

    const queue = [...selected];
    while (queue.length > 0) {
      const id = queue.pop()!;
      for (const child of childrenByParent.get(id) ?? []) {
        if (selected.has(child)) continue;
        selected.add(child);
        queue.push(child);
      }
    }
  }

  // Eltern vor Kindern. Eine Seite, deren Elternteil nicht dabei ist, zählt als
  // Wurzel — sonst käme sie in einem gedrehten Baum nie an die Reihe.
  const ordered: TransferPlan["ordered"] = [];
  const placed = new Set<string>();
  const warnings: string[] = [];

  const depthOf = (page: PageWithBlocks): number => {
    let depth = 0;
    let parentId = page.parentPageId;
    const guard = new Set<string>([page.id]);
    while (parentId && selected.has(parentId) && !guard.has(parentId)) {
      guard.add(parentId);
      depth += 1;
      parentId = byId.get(parentId)?.parentPageId ?? null;
    }
    return depth;
  };

  let remaining = [...selected].map((id) => byId.get(id)!);
  while (remaining.length > 0) {
    const ready = remaining.filter(
      (page) => !page.parentPageId || !selected.has(page.parentPageId) || placed.has(page.parentPageId),
    );

    // Zyklus im Elternfeld: den Rest anhängen, statt endlos zu drehen.
    const batch = ready.length > 0 ? ready : remaining;
    if (ready.length === 0) {
      warnings.push("Ein Zyklus in der Seitenhierarchie wurde aufgelöst; die Ordnung kann abweichen.");
    }

    batch.sort((a, b) => (a.sortIndex ?? Number.MAX_SAFE_INTEGER) - (b.sortIndex ?? Number.MAX_SAFE_INTEGER));
    for (const page of batch) {
      placed.add(page.id);
      ordered.push({ page, implicit: !explicit.has(page.id), depth: depthOf(page) });
    }

    remaining = remaining.filter((page) => !placed.has(page.id));
  }

  const orphans = ordered.filter(
    ({ page }) => page.parentPageId && !selected.has(page.parentPageId),
  );
  if (orphans.length > 0) {
    warnings.push(
      `${orphans.length} Seite(n) kommen ohne ihre übergeordnete Seite und stehen in der Zielwelt oben: ${orphans
        .slice(0, 5)
        .map(({ page }) => page.title)
        .join(", ")}${orphans.length > 5 ? " …" : ""}.`,
    );
  }

  const taken = new Set(targetPages.map((page) => page.slug));
  const slugByPageId = new Map<string, string>();
  for (const { page } of ordered) {
    const slug = pickUniqueSlug(page.slug, taken, { fallback: "seite", maxLength: 80 });
    taken.add(slug);
    slugByPageId.set(page.id, slug);
  }

  const knownAfterwards = [
    ...targetPages.flatMap((page) => [
      page.title,
      page.slug,
      ...(Array.isArray(page.aliases) ? (page.aliases as string[]) : []),
    ]),
    ...ordered.flatMap(({ page }) => [page.title, slugByPageId.get(page.id) ?? page.slug]),
  ];

  const { unresolved } = auditWikiLinks(
    ordered.map(({ page }) => blockContent(page)),
    knownAfterwards,
  );

  if (unresolved.length > 0) {
    warnings.push(
      `${unresolved.length} Verweis(e) zeigen in der Zielwelt ins Leere: ${unresolved.slice(0, 8).join(", ")}${unresolved.length > 8 ? " …" : ""}.`,
    );
  }

  return { ordered, slugByPageId, danglingLinks: unresolved, warnings };
}

async function loadPlan(repo: UweRepository, options: TransferPagesOptions) {
  if (options.sourceWorldSlug === options.targetWorldSlug) {
    throw new Error("Quell- und Zielwelt sind dieselbe.");
  }

  const targetWorld = await repo.getWorldBySlug(options.targetWorldSlug);
  if (!targetWorld) {
    throw new Error(`Zielwelt „${options.targetWorldSlug}" wurde nicht gefunden.`);
  }

  const [sourcePages, targetPages] = await Promise.all([
    repo.listPagesWithBlocksForGraphUnfiltered(options.sourceWorldSlug, {}),
    repo.listPagesByWorld(options.targetWorldSlug),
  ]);

  return { targetWorld, plan: buildTransferPlan(sourcePages, targetPages, options) };
}

/** Was passieren würde — ohne etwas zu schreiben. */
export async function previewTransferPages(
  repo: UweRepository,
  options: TransferPagesOptions,
): Promise<TransferPreview> {
  const { plan } = await loadPlan(repo, options);

  return {
    items: plan.ordered.map(({ page, implicit, depth }) => ({
      sourcePageId: page.id,
      title: page.title,
      type: page.type,
      slug: plan.slugByPageId.get(page.id) ?? page.slug,
      implicit,
      depth,
    })),
    danglingLinks: plan.danglingLinks,
    warnings: plan.warnings,
  };
}

export async function transferPagesToWorld(
  repo: UweRepository,
  options: TransferPagesOptions & { confirmed: boolean },
): Promise<TransferPagesResult> {
  if (!options.confirmed) {
    throw new Error("Übernahme erfordert confirmed: true.");
  }

  const { targetWorld, plan } = await loadPlan(repo, options);

  const result: TransferPagesResult = {
    created: 0,
    failed: 0,
    pages: [],
    danglingLinks: plan.danglingLinks,
    warnings: [...plan.warnings],
    undo: { createdPageIds: [] },
  };

  const idMap = new Map<string, string>();

  for (const { page } of plan.ordered) {
    try {
      const created = await repo.createPage({
        worldId: targetWorld.id,
        campaignId: options.targetCampaignId ?? null,
        parentPageId: page.parentPageId ? (idMap.get(page.parentPageId) ?? null) : null,
        sortIndex: page.sortIndex,
        title: page.title,
        slug: plan.slugByPageId.get(page.id) ?? page.slug,
        type: page.type,
        summary: page.summary,
        canonicalStatus: page.canonicalStatus,
        tags: Array.isArray(page.tags) ? (page.tags as string[]) : [],
        aliases: Array.isArray(page.aliases) ? (page.aliases as string[]) : [],
        contentBlocks: page.contentBlocks.map((block) => ({
          type: block.type,
          sortOrder: block.sortOrder,
          content: block.content,
          metadata: {
            ...(block.metadata && typeof block.metadata === "object" && !Array.isArray(block.metadata)
              ? (block.metadata as Record<string, unknown>)
              : {}),
            transferredFrom: {
              worldSlug: options.sourceWorldSlug,
              pageId: page.id,
              slug: page.slug,
            },
          } as Prisma.InputJsonValue,
        })),
      });

      idMap.set(page.id, created.id);
      result.created += 1;
      result.undo.createdPageIds.push(created.id);
      result.pages.push({ sourcePageId: page.id, pageId: created.id, slug: created.slug });
    } catch (error) {
      result.failed += 1;
      result.warnings.push(
        `„${page.title}" konnte nicht übernommen werden: ${error instanceof Error ? error.message : "unbekannter Fehler"}.`,
      );
    }
  }

  return result;
}
