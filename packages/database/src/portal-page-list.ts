/**
 * Cursor-paginierte Seitenliste für Portal-Betrachter.
 *
 * `listPagesForViewer` lädt bis heute die ganze Welt und die vier
 * Portal-Listen (Wiki/NPCs/Quests/Handouts) filterten identisch in-memory
 * nach. Dieses Modul zieht Typ- und Textfilter in die DB-Query und schneidet
 * das Ergebnis per Cursor — als reine PERFORMANCE-Vorfilterung.
 *
 * SICHERHEIT: Das Tor bleibt `filterPagesForViewer` (fail-closed über
 * `portalReleased`), deshalb lädt das Select das Feld zwingend mit und jedes
 * Ergebnis läuft weiter durch den Filter. Die DB-Query darf Zeilen zu viel
 * liefern (der JS-Filter wirft sie heraus), aber nie das Tor ersetzen — genau
 * die Äquivalenz, die `list-pages-narrowing.test.ts` für die ungefilterte
 * Liste festschreibt, sichert `portal-page-list.test.ts` hier ab.
 */
import type { AccessContext } from "@uwe/auth";
import {
  canReadWorld,
  filterPagesForViewer,
  redactDmSectionsForViewer,
  scopeFromAccessContext,
} from "@uwe/auth";
import type { PrismaClient } from "./client";
import type { PageType, Prisma } from "./generated/prisma/client";

export interface ListPagesForViewerPagedOptions {
  /** Nur Seiten dieses Typs (z. B. "npc", "quest", "handout"). */
  type?: PageType;
  /** Textsuche über Titel, Slug und Kurzbeschreibung. */
  query?: string;
  /** `nextCursor` der vorherigen Seite; weglassen für die erste Seite. */
  cursor?: string;
  /** Batch-Größe, Default {@link DEFAULT_PAGE_LIST_LIMIT}. */
  limit?: number;
}

export const DEFAULT_PAGE_LIST_LIMIT = 100;
const MAX_PAGE_LIST_LIMIT = 500;

/** Dieselben Felder wie `listPagesForViewer` — inkl. dem Pflichtfeld
 *  `portalReleased`, ohne das der fail-closed-Filter alles herauswirft. */
const PAGE_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  type: true,
  summary: true,
  questStatus: true,
  updatedAt: true,
  portalReleased: true,
} as const;

export type ViewerPageListItem = Prisma.PageGetPayload<{ select: typeof PAGE_LIST_SELECT }>;

export interface ViewerPageListResult {
  pages: ViewerPageListItem[];
  /**
   * Cursor für die nächste Seite oder `null` am Ende. Er ist bewusst die id
   * der letzten DB-Zeile VOR dem Viewer-Filter — sonst würde die Fortsetzung
   * Zeilen überspringen, die nur für diesen Betrachter unsichtbar sind.
   */
  nextCursor: string | null;
}

/**
 * SQLite-LIKE ist nur für ASCII case-insensitiv: `'ü' LIKE 'Ü'` matcht nicht.
 * Damit „über" weiterhin „Über den Fluss" findet, sucht die Query zusätzlich
 * nach den gängigen Schreibvarianten (klein, GROSS, Erstbuchstabe groß).
 * Exotische Mischformen fängt der JS-Nachfilter unten ohnehin nicht mehr ein —
 * die DB-Vorauswahl kann sie schlicht verpassen; das ist der dokumentierte
 * Kompromiss der DB-seitigen Suche.
 */
function queryVariants(query: string): string[] {
  const lower = query.toLocaleLowerCase("de");
  const variants = new Set([
    query,
    lower,
    query.toLocaleUpperCase("de"),
    lower.charAt(0).toLocaleUpperCase("de") + lower.slice(1),
  ]);
  return [...variants];
}

function buildTextFilter(query: string): Prisma.PageWhereInput {
  return {
    OR: queryVariants(query).flatMap((variant) => [
      { title: { contains: variant } },
      { slug: { contains: variant } },
      { summary: { contains: variant } },
    ]),
  };
}

/** Haystack-Prüfung der bisherigen In-Memory-Filter der vier Portal-Listen. */
function matchesQuery(page: ViewerPageListItem, query: string): boolean {
  const haystack = [page.title, page.slug, page.summary ?? ""]
    .join(" ")
    .toLocaleLowerCase("de");
  return haystack.includes(query.toLocaleLowerCase("de"));
}

export async function listPagesForViewerPaged(
  db: PrismaClient,
  worldSlug: string,
  ctx: AccessContext,
  options: ListPagesForViewerPagedOptions = {},
): Promise<ViewerPageListResult> {
  const world = await db.world.findUnique({
    where: { slug: worldSlug },
    select: { id: true },
  });
  if (!world) {
    return { pages: [], nextCursor: null };
  }

  const scope = scopeFromAccessContext(ctx, world.id);
  if (!canReadWorld(ctx.user, scope.world, scope)) {
    return { pages: [], nextCursor: null };
  }

  const limit = Math.min(
    Math.max(Math.trunc(options.limit ?? DEFAULT_PAGE_LIST_LIMIT), 1),
    MAX_PAGE_LIST_LIMIT,
  );
  const query = options.query?.trim();

  // Eine Zeile mehr als angefordert verrät, ob es weitergeht — ohne count(*).
  const rows = await db.page.findMany({
    where: {
      worldId: world.id,
      ...(options.type ? { type: options.type } : {}),
      ...(query ? buildTextFilter(query) : {}),
    },
    select: PAGE_LIST_SELECT,
    orderBy: [{ title: "asc" }, { id: "asc" }],
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const batch = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (batch[batch.length - 1]?.id ?? null) : null;

  // DAS Tor — die DB-Vorfilterung oben ist nur Performance, nie die Freigabe.
  const visible = filterPagesForViewer(ctx, batch)
    .map((page) => {
      const summary = redactDmSectionsForViewer(ctx, page.summary);
      return summary === page.summary ? page : { ...page, summary };
    })
    // Nachfilter auf dem GESCHNITTENEN Text: Die DB durchsucht die rohe
    // Kurzbeschreibung mitsamt `:::dm`-Bereichen. Ohne diesen Schritt würde
    // ein Treffer im DM-Text die Seite listen und so verraten, dass der
    // Suchbegriff irgendwo im Verborgenen steht.
    .filter((page) => !query || matchesQuery(page, query));

  return { pages: visible, nextCursor };
}
