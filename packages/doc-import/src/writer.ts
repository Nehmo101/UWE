/**
 * Schreibpfad des Dokument-Imports.
 *
 * Das einzige Modul dieses Packages, das eine Datenbank sieht — deshalb liegt es
 * hinter dem eigenen Einstiegspunkt `@uwe/doc-import/writer`. Es folgt demselben
 * Muster wie `@uwe/knoteforge-import`: das Repository kommt herein, Prisma bleibt
 * draußen.
 *
 * Zwei Durchgänge, und der Grund dafür ist der Kern der Sache:
 *
 * 1. **Seiten anlegen.** Die Entwürfe kommen in Dokumentreihenfolge, Eltern vor
 *    Kindern — wenn ein Kind an die Reihe kommt, hat sein Elternteil schon eine
 *    ID. `parentPageId` und `sortIndex` werden dabei tatsächlich gesetzt; genau
 *    das hat der bestehende Importer nie getan, weshalb jede importierte
 *    Hierarchie bisher flach ankam.
 * 2. **Kanten anlegen.** Erst wenn alles steht, lassen sich `siehe_auch`-Ziele
 *    auflösen — auch solche, die auf eine Seite aus demselben Import zeigen.
 *
 * `[[Wikilinks]]` werden bewusst **nicht** zu `PageLink`-Zeilen: sie bleiben Text
 * und werden bei jedem Aufruf gegen den Welt-Index aufgelöst. Nur was jemand
 * ausdrücklich als Beziehung hingeschrieben hat, wird eine Kante.
 */

import type { PageType, Prisma, UweRepository } from "@uwe/database/server";
import { normalizeLookupKey, pickUniqueSlug } from "@uwe/shared-utils/slug";
import type { PageDraft, RelationDraft } from "./types";

export interface WriteDocImportOptions {
  worldSlug: string;
  /** Ohne diese Bestätigung wird nichts geschrieben. */
  confirmed: boolean;
  /** Nur diese Entwurfs-Schlüssel schreiben. Ohne Angabe: alle. */
  keys?: string[];
  /**
   * Von Hand korrigierte Seitentypen, nach Entwurfs-Schlüssel.
   *
   * Die Zuordnung des Imports ist eine gute Vorbelegung, keine Wahrheit — wer
   * in der Vorschau sieht, dass „Die Stillzelle — Arathion" eine Person ist und
   * kein Hintergrundtext, soll das dort sagen können und nicht hinterher 63
   * Seiten einzeln nachbessern müssen.
   */
  typeOverrides?: Record<string, PageType>;
}

export interface WrittenPage {
  key: string;
  pageId: string;
  slug: string;
}

export interface WriteDocImportResult {
  created: number;
  failed: number;
  linksCreated: number;
  pages: WrittenPage[];
  warnings: string[];
  /** Für den Rückbau über das Aktivitätsprotokoll. */
  undo: { createdPageIds: string[]; createdLinkIds: string[] };
}

interface LookupIndex {
  byKey: Map<string, string>;
}

function buildLookupIndex(
  existing: Array<{ id: string; title: string; slug: string; aliases?: unknown }>,
): LookupIndex {
  const byKey = new Map<string, string>();

  const remember = (value: string | undefined, id: string) => {
    if (!value?.trim()) return;
    const key = normalizeLookupKey(value);
    // Erster Treffer gewinnt — dieselbe Regel wie bei der Wikilink-Auflösung.
    if (!byKey.has(key)) byKey.set(key, id);
  };

  for (const page of existing) {
    remember(page.title, page.id);
    remember(page.slug, page.id);
    if (Array.isArray(page.aliases)) {
      for (const alias of page.aliases) {
        if (typeof alias === "string") remember(alias, page.id);
      }
    }
  }

  return { byKey };
}

export async function writeDocImport(
  repo: UweRepository,
  drafts: PageDraft[],
  relations: RelationDraft[],
  options: WriteDocImportOptions,
): Promise<WriteDocImportResult> {
  if (!options.confirmed) {
    throw new Error("Import erfordert confirmed: true.");
  }

  const world = await repo.getWorldBySlug(options.worldSlug);
  if (!world) {
    throw new Error(`Welt „${options.worldSlug}" wurde nicht gefunden.`);
  }

  const existingPages = await repo.listPagesByWorld(options.worldSlug);
  const campaigns = await repo.listCampaignsByWorld(options.worldSlug);

  const campaignByName = new Map<string, string>();
  for (const campaign of campaigns) {
    campaignByName.set(normalizeLookupKey(campaign.name), campaign.id);
    campaignByName.set(normalizeLookupKey(campaign.slug), campaign.id);
  }

  const takenSlugs = new Set(existingPages.map((page) => page.slug));
  const lookup = buildLookupIndex(existingPages);
  const selected = options.keys ? new Set(options.keys) : null;

  const result: WriteDocImportResult = {
    created: 0,
    failed: 0,
    linksCreated: 0,
    pages: [],
    warnings: [],
    undo: { createdPageIds: [], createdLinkIds: [] },
  };

  const keyToPageId = new Map<string, string>();

  for (const draft of drafts) {
    if (selected && !selected.has(draft.key)) continue;

    try {
      const slug = pickUniqueSlug(draft.slug, takenSlugs, { fallback: "seite", maxLength: 80 });
      const campaignId = resolveCampaignId(draft, campaignByName);

      const parentPageId = draft.parentKey ? (keyToPageId.get(draft.parentKey) ?? null) : null;
      if (draft.parentKey && !parentPageId) {
        // Das Elternteil wurde abgewählt — die Seite entsteht trotzdem, nur eine Ebene höher.
        result.warnings.push(
          `„${draft.title}" wurde ohne übergeordnete Seite angelegt, weil diese nicht mit importiert wurde.`,
        );
      }

      const page = await repo.createPage({
        worldId: world.id,
        campaignId,
        parentPageId,
        sortIndex: draft.sortIndex,
        title: draft.title,
        slug,
        type: options.typeOverrides?.[draft.key] ?? draft.type,
        summary: draft.summary,
        canonicalStatus: draft.canonicalStatus ?? undefined,
        tags: draft.tags,
        aliases: draft.aliases,
        contentBlocks: draft.html
          ? [
              {
                type: "rich_text",
                sortOrder: 0,
                content: draft.html,
                metadata: draft.metadata as Prisma.InputJsonValue,
              },
            ]
          : [],
      });

      takenSlugs.add(page.slug);
      keyToPageId.set(draft.key, page.id);
      lookup.byKey.set(normalizeLookupKey(draft.title), page.id);
      if (!lookup.byKey.has(normalizeLookupKey(page.slug))) {
        lookup.byKey.set(normalizeLookupKey(page.slug), page.id);
      }

      result.created += 1;
      result.undo.createdPageIds.push(page.id);
      result.pages.push({ key: draft.key, pageId: page.id, slug: page.slug });
    } catch (error) {
      result.failed += 1;
      result.warnings.push(
        `„${draft.title}" konnte nicht angelegt werden: ${error instanceof Error ? error.message : "unbekannter Fehler"}.`,
      );
    }
  }

  for (const relation of relations) {
    const sourcePageId = keyToPageId.get(relation.sourceKey);
    if (!sourcePageId) continue;

    const targetPageId = lookup.byKey.get(normalizeLookupKey(relation.targetLookup));
    if (!targetPageId || targetPageId === sourcePageId) continue;

    try {
      const link = await repo.createPageLink({
        sourcePageId,
        targetPageId,
        relationType: relation.relationType,
        label: relation.label,
      });
      result.linksCreated += 1;
      result.undo.createdLinkIds.push(link.id);
    } catch (error) {
      result.warnings.push(
        `Beziehung zu „${relation.targetLookup}" konnte nicht angelegt werden: ${error instanceof Error ? error.message : "unbekannter Fehler"}.`,
      );
    }
  }

  return result;
}

/**
 * Eine Seite gehört zu genau einer Kampagne (`Page.campaignId`), das Frontmatter
 * darf aber mehrere nennen. Die erste, die es in der Welt gibt, gewinnt; alle
 * bleiben zusätzlich als `kampagne/…`-Tag erhalten, damit die Mehrfachzuordnung
 * über Filter und Graph trotzdem sichtbar ist.
 */
function resolveCampaignId(
  draft: PageDraft,
  campaignByName: Map<string, string>,
): string | null {
  for (const name of draft.campaigns) {
    const id = campaignByName.get(normalizeLookupKey(name));
    if (id) return id;
  }
  return null;
}
