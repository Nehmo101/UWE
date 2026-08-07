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

import type {
  ImportPageUpdateSnapshot,
  PageType,
  Prisma,
  UweRepository,
} from "@uwe/database/server";
import { normalizeLookupKey, pickUniqueSlug } from "@uwe/shared-utils/slug";
import { extractMagicItemData } from "./semantic/item-extract";
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
  /**
   * Trägt ein Entwurf den Namen einer Seite, die es in der Zielwelt schon gibt,
   * wird deren Text **ergänzt** statt eine zweite Seite anzulegen. Standard: an.
   *
   * **Warum das der Standardfall sein muss.** Ein Kampagnenband beschreibt
   * zwangsläufig Personen, Orte und Mächte, die die Welt längst kennt. Ohne
   * diese Regel entstand für jede von ihnen eine zweite Seite — beim Import von
   * *Dunkelsonne* waren das 22 Doppelungen, darunter der Imperator, Nepurga,
   * alle vier Inquisitoren und eine Spielerfigur. Die Vorschau meldete das
   * lediglich als `duplicate`, was harmlos klingt und es nicht ist: Von da an
   * gibt es zwei Seiten mit demselben Namen, und der Crosslinker trifft ohne
   * Warnung eine davon.
   *
   * `false` legt die alte Fassung wieder frei — nützlich, wenn ein Band
   * absichtlich neben den Bestand gesetzt und danach von Hand verglichen wird.
   */
  mergeIntoExisting?: boolean;
}

export interface WrittenPage {
  key: string;
  pageId: string;
  slug: string;
  disposition: "created" | "merged" | "unchanged";
}

/**
 * Was der Rückbau braucht, um eine ergänzte Seite wieder herzustellen.
 *
 * Bewusst der Typ des Undo-Dienstes und keine eigene Form: Der Rückbau konnte
 * ergänzte Seiten immer schon zurücknehmen (`undoImportExecute` stellt die
 * Skalare wieder her und löscht die hinzugefügten Blöcke) — der Schreibpfad hat
 * es nur nie befüllt.
 */
export type MergedPageRecord = ImportPageUpdateSnapshot;

export interface WriteDocImportResult {
  created: number;
  /** Entwürfe, die in eine bestehende Seite gewandert sind. */
  merged: number;
  failed: number;
  linksCreated: number;
  /** Gegenstandsseiten, für die Werkbank-Daten aus dem Text entstanden sind. */
  itemsStructured: number;
  pages: WrittenPage[];
  warnings: string[];
  /** Für den Rückbau über das Aktivitätsprotokoll. */
  undo: { createdPageIds: string[]; createdLinkIds: string[]; updatedPages: MergedPageRecord[] };
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
    merged: 0,
    failed: 0,
    linksCreated: 0,
    itemsStructured: 0,
    pages: [],
    warnings: [],
    undo: { createdPageIds: [], createdLinkIds: [], updatedPages: [] },
  };

  const keyToPageId = new Map<string, string>();
  const mergeOn = options.mergeIntoExisting !== false;
  /** Ergänzte Seiten dieses Laufs — mehrere Entwürfe dürfen dieselbe treffen. */
  const mergedById = new Map<string, MergedPageRecord>();

  for (const draft of drafts) {
    if (selected && !selected.has(draft.key)) continue;

    try {
      const existingId = mergeOn ? lookup.byKey.get(normalizeLookupKey(draft.title)) : undefined;
      if (existingId) {
        const merged = await mergeIntoExistingPage(repo, existingId, draft, mergedById);
        keyToPageId.set(draft.key, existingId);
        const existing = existingPages.find((page) => page.id === existingId);
        result.pages.push({
          key: draft.key,
          pageId: existingId,
          slug: existing?.slug ?? draft.slug,
          disposition: merged === "schon-da" ? "unchanged" : "merged",
        });
        if (merged === "schon-da") {
          result.warnings.push(
            `„${draft.title}" stand schon aus einem früheren Lauf auf der bestehenden Seite — nichts doppelt angehängt.`,
          );
        } else {
          result.merged += 1;
        }
        continue;
      }

      const slug = pickUniqueSlug(draft.slug, takenSlugs, { fallback: "seite", maxLength: 80 });
      const campaignId = resolveCampaignId(draft, campaignByName);

      const parentPageId = draft.parentKey ? (keyToPageId.get(draft.parentKey) ?? null) : null;
      if (draft.parentKey && !parentPageId) {
        // Das Elternteil wurde abgewählt — die Seite entsteht trotzdem, nur eine Ebene höher.
        result.warnings.push(
          `„${draft.title}" wurde ohne übergeordnete Seite angelegt, weil diese nicht mit importiert wurde.`,
        );
      }

      const pageType = options.typeOverrides?.[draft.key] ?? draft.type;

      const page = await repo.createPage({
        worldId: world.id,
        campaignId,
        parentPageId,
        sortIndex: draft.sortIndex,
        title: draft.title,
        slug,
        type: pageType,
        summary: draft.summary,
        canonicalStatus: draft.canonicalStatus ?? undefined,
        // Ein frisch importiertes Kapitel ist noch nicht vorbereitet. Ohne
        // Status zeigt das Kampagnen-Cockpit den Bogen ohne Fortschrittsangabe.
        prepStatus: pageType === "story_arc" ? "unprepared" : undefined,
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

      // Gegenstände bringen ihre Werkbank-Daten gleich mit. Ohne diesen Schritt
      // landete ein importiertes Kampagnenbuch zwar vollständig im Wiki, die
      // Magic-Item-Werkbank blieb aber leer — sie kannte nur das Studio-Formular.
      if (pageType === "item" && draft.html) {
        try {
          const itemData = extractMagicItemData(draft.title, draft.html);
          if (itemData) {
            await repo.upsertStructuredItem({
              worldId: world.id,
              pageId: page.id,
              data: itemData as unknown as Prisma.InputJsonValue,
            });
            result.itemsStructured += 1;
          }
        } catch (error) {
          // Die Seite selbst steht schon — ein Fehler hier darf den Import nicht
          // scheitern lassen, nur die Werkbank dieser einen Seite leer lassen.
          result.warnings.push(
            `Werkbank-Daten für „${draft.title}" konnten nicht erzeugt werden: ${
              error instanceof Error ? error.message : "unbekannter Fehler"
            }.`,
          );
        }
      }

      takenSlugs.add(page.slug);
      keyToPageId.set(draft.key, page.id);
      lookup.byKey.set(normalizeLookupKey(draft.title), page.id);
      if (!lookup.byKey.has(normalizeLookupKey(page.slug))) {
        lookup.byKey.set(normalizeLookupKey(page.slug), page.id);
      }

      result.created += 1;
      result.undo.createdPageIds.push(page.id);
      result.pages.push({ key: draft.key, pageId: page.id, slug: page.slug, disposition: "created" });
    } catch (error) {
      result.failed += 1;
      result.warnings.push(
        `„${draft.title}" konnte nicht angelegt werden: ${error instanceof Error ? error.message : "unbekannter Fehler"}.`,
      );
    }
  }

  result.undo.updatedPages = [...mergedById.values()];

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

/** Kennzeichen, unter dem ein angehängter Abschnitt seinen Entwurf wiedererkennt. */
function mergeMarker(draft: PageDraft): string {
  return `doc-import:${draft.key}`;
}

/**
 * Hängt einen Entwurf an eine bestehende Seite, statt eine zweite anzulegen.
 *
 * **Was übernommen wird:** der Text als eigener Abschnitt mit Überschrift, die
 * Aliase des Entwurfs und sein Titel (damit Verweise darauf die Seite finden).
 *
 * **Was ausdrücklich nicht:** Typ, Kampagne, Kanon-Status und Portal-Freigabe
 * der bestehenden Seite. Wer eine gepflegte, freigegebene Weltseite um ein
 * Kapitel ergänzt, will sie erweitern — nicht sie zum Entwurf zurückstufen.
 *
 * **Zweimal importieren hängt nichts doppelt an.** Jeder Abschnitt trägt in
 * seinen Metadaten das Kennzeichen seines Entwurfs; ist es schon da, passiert
 * nichts. Ohne diese Sperre wüchse jede Seite bei jedem Lauf um ihren eigenen
 * Text.
 */
async function mergeIntoExistingPage(
  repo: UweRepository,
  pageId: string,
  draft: PageDraft,
  mergedById: Map<string, MergedPageRecord>,
): Promise<"ergaenzt" | "schon-da"> {
  const page = await repo.getPageById(pageId);
  if (!page) throw new Error(`Seite ${pageId} verschwand während des Imports.`);

  const marker = mergeMarker(draft);
  const schonDa = page.contentBlocks.some(
    (block) => (block.metadata as { docImportMerge?: string } | null)?.docImportMerge === marker,
  );

  // Der Zustand vor dem ersten Eingriff dieses Laufs — für den Rückbau.
  let record = mergedById.get(pageId);
  if (!record) {
    record = {
      pageId,
      page: {
        id: page.id,
        worldId: page.worldId,
        campaignId: page.campaignId,
        parentPageId: page.parentPageId,
        title: page.title,
        slug: page.slug,
        type: page.type,
        summary: page.summary,
        canonicalStatus: page.canonicalStatus,
        aiReviewedAt: page.aiReviewedAt,
        tags: page.tags,
        aliases: page.aliases,
      },
      previousBlockIds: page.contentBlocks.map((block) => block.id),
      addedBlockIds: [],
    };
    mergedById.set(pageId, record);
  }

  if (schonDa) return "schon-da";

  if (draft.html?.trim()) {
    const sortOrder = page.contentBlocks.reduce((max, block) => Math.max(max, block.sortOrder), -1) + 1;
    const block = await repo.createContentBlock(pageId, {
      type: "rich_text",
      sortOrder,
      content: `<h2>${escapeHeading(draft.title)}</h2>\n${draft.html}`,
      metadata: { ...(draft.metadata as Record<string, unknown>), docImportMerge: marker },
    });
    record.addedBlockIds.push(block.id);
  }

  const aliases = new Set<string>(
    Array.isArray(page.aliases) ? page.aliases.filter((a): a is string => typeof a === "string") : [],
  );
  const vorher = aliases.size;
  for (const alias of draft.aliases) aliases.add(alias);
  if (normalizeLookupKey(draft.title) !== normalizeLookupKey(page.title)) aliases.add(draft.title);
  if (aliases.size !== vorher) {
    await repo.updatePage(pageId, { aliases: [...aliases] });
  }

  return "ergaenzt";
}

/** Nur das Nötigste — der Titel steht danach in einer Überschrift. */
function escapeHeading(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
