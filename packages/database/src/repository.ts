import {
  createAssetRecord,
  deleteAssetRecord,
  getAssetById,
  linkAssetToContentBlock,
  linkAssetToPage,
  listAssetsByWorld,
  listAssetsForPage,
  unlinkAssetFromPage,
  updateAssetRecord,
  type CreateAssetInput,
  type UpdateAssetInput,
} from "./asset-repository";
import type {
  AssetType,
  CanonicalStatus,
  ContentBlockType,
  Page,
  PageLink,
  PageType,
  Prisma,
} from "./generated/prisma/client";
import { pageTypesForNavCategory, type NavCategory } from "./page-types";
import { createPrismaClient, type PrismaClient } from "./client";
import { parseStringArray, toJsonArray, withParsedArrays } from "./json-utils";
import { SettingsService } from "./settings-service";
import {
  searchForWikiContext,
  searchGlobalForDm,
  type SearchOptions,
  type SearchResultItem,
} from "./search-service";

export type { SearchOptions, SearchResultItem, SearchEntityFilter, SearchMatchField } from "./search-service";
export {
  SEARCH_ENTITY_FILTERS,
  SEARCH_ENTITY_FILTER_LABELS,
  buildSearchIndex,
  searchIndex,
} from "./search-service";

export type {
  Campaign,
  Asset,
  AssetType,
  CanonicalStatus,
  ContentBlock,
  ContentBlockType,
  Page,
  PageLink,
  PageType,
  World,
} from "./generated/prisma/client";

export {
  CanonicalStatus as CanonicalStatusEnum,
  ContentBlockType as ContentBlockTypeEnum,
  AssetType as AssetTypeEnum,
  PageType as PageTypeEnum,
} from "./generated/prisma/client";

export type { CreateAssetInput, UpdateAssetInput } from "./asset-repository";

export interface CreateWorldInput {
  name: string;
  slug: string;
  description?: string | null;
}

export interface CreateCampaignInput {
  worldId: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface CreateContentBlockInput {
  type: ContentBlockType;
  sortOrder: number;
  content?: string;
  metadata?: Prisma.InputJsonValue;
  assetId?: string | null;
}

export interface CreatePageInput {
  worldId: string;
  campaignId?: string | null;
  parentPageId?: string | null;
  /** Lesereihenfolge unter Geschwistern; `null` sortiert ans Ende (nach Titel). */
  sortIndex?: number | null;
  title: string;
  slug: string;
  type: PageType;
  summary?: string | null;
  canonicalStatus?: CanonicalStatus;
  /** Freigegeben fuers Portal — siehe `filterPagesForViewer`. */
  portalReleased?: boolean;
  prepStatus?: import("./generated/prisma/client").DungeonPrepStatus | null;
  questStatus?: import("./generated/prisma/client").QuestLifecycleStatus | null;
  tags?: string[];
  aliases?: string[];
  contentBlocks?: CreateContentBlockInput[];
}

export interface UpdatePageInput {
  title?: string;
  slug?: string;
  type?: PageType;
  summary?: string | null;
  campaignId?: string | null;
  parentPageId?: string | null;
  sortIndex?: number | null;
  canonicalStatus?: CanonicalStatus;
  /** Freigegeben fuers Portal — siehe `filterPagesForViewer`. */
  portalReleased?: boolean;
  prepStatus?: import("./generated/prisma/client").DungeonPrepStatus | null;
  questStatus?: import("./generated/prisma/client").QuestLifecycleStatus | null;
  tags?: string[];
  aliases?: string[];
  aiReviewedAt?: Date | null;
}

export interface UpdateContentBlockInput {
  type?: ContentBlockType;
  sortOrder?: number;
  content?: string;
  metadata?: Prisma.InputJsonValue;
  assetId?: string | null;
}

export type PageWithBlocks = Prisma.PageGetPayload<{
  include: { contentBlocks: true; campaign: true };
}>;

export type PageSummary = Prisma.PageGetPayload<{
  include: { campaign: true };
}>;

export type PageLinkPageInfo = Pick<Page, "id" | "title" | "slug" | "type">;

export type PageLinkWithPages = PageLink & {
  sourcePage: PageLinkPageInfo;
  targetPage: PageLinkPageInfo;
};

export interface PageLinksForPage {
  outgoing: PageLinkWithPages[];
  incoming: PageLinkWithPages[];
}

export type PublicPage = PageWithBlocks;

export class UweRepository {
  private settingsService?: SettingsService;

  constructor(private readonly db: PrismaClient) {}

  private getSettingsService(): SettingsService {
    if (!this.settingsService) {
      this.settingsService = new SettingsService(this.db);
    }
    return this.settingsService;
  }

  async listWorlds() {
    return this.db.world.findMany({
      orderBy: { name: "asc" },
    });
  }

  async getWorldBySlug(slug: string) {
    return this.db.world.findUnique({ where: { slug } });
  }

  async listCampaignsByWorld(worldSlug: string) {
    const world = await this.getWorldBySlug(worldSlug);
    if (!world) return [];

    return this.db.campaign.findMany({
      where: { worldId: world.id },
      orderBy: { name: "asc" },
    });
  }

  async getCampaignBySlug(worldSlug: string, campaignSlug: string) {
    const world = await this.getWorldBySlug(worldSlug);
    if (!world) return null;

    return this.db.campaign.findUnique({
      where: {
        worldId_slug: {
          worldId: world.id,
          slug: campaignSlug,
        },
      },
    });
  }

  async createWorld(input: CreateWorldInput) {
    return this.db.world.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
      },
    });
  }

  async createCampaign(input: CreateCampaignInput) {
    return this.db.campaign.create({
      data: {
        worldId: input.worldId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
      },
    });
  }

  async createPage(input: CreatePageInput) {
    const defaults = await this.getSettingsService().getWorldDefaults();

    return this.db.page.create({
      data: {
        worldId: input.worldId,
        campaignId: input.campaignId ?? null,
        parentPageId: input.parentPageId ?? null,
        sortIndex: input.sortIndex ?? null,
        title: input.title,
        slug: input.slug,
        type: input.type,
        summary: input.summary ?? null,
        canonicalStatus: input.canonicalStatus ?? defaults.defaultCanonicalStatus,
        portalReleased: input.portalReleased ?? false,
        prepStatus: input.prepStatus ?? null,
        questStatus: input.questStatus ?? null,
        tags: toJsonArray(input.tags),
        aliases: toJsonArray(input.aliases),
        contentBlocks: input.contentBlocks
          ? {
              create: input.contentBlocks.map((block) => ({
                type: block.type,
                sortOrder: block.sortOrder,
                content: block.content ?? "",
                metadata: block.metadata ?? {},
                assetId: block.assetId ?? null,
              })),
            }
          : undefined,
      },
      include: {
        contentBlocks: { orderBy: { sortOrder: "asc" } },
        campaign: true,
      },
    });
  }

  async updatePage(pageId: string, input: UpdatePageInput) {
    return this.db.page.update({
      where: { id: pageId },
      data: {
        title: input.title,
        slug: input.slug,
        type: input.type,
        summary: input.summary,
        campaignId: input.campaignId,
        parentPageId: input.parentPageId,
        sortIndex: input.sortIndex,
        canonicalStatus: input.canonicalStatus,
        portalReleased: input.portalReleased,
        prepStatus: input.prepStatus,
        questStatus: input.questStatus,
        tags: input.tags ? toJsonArray(input.tags) : undefined,
        aliases: input.aliases ? toJsonArray(input.aliases) : undefined,
        aiReviewedAt: input.aiReviewedAt,
      },
      include: {
        contentBlocks: { orderBy: { sortOrder: "asc" } },
        campaign: true,
      },
    });
  }

  async createContentBlock(pageId: string, input: CreateContentBlockInput) {
    return this.db.contentBlock.create({
      data: {
        pageId,
        type: input.type,
        sortOrder: input.sortOrder,
        content: input.content ?? "",
        metadata: input.metadata ?? {},
        assetId: input.assetId ?? null,
      },
    });
  }

  async updateContentBlock(blockId: string, input: UpdateContentBlockInput) {
    return this.db.contentBlock.update({
      where: { id: blockId },
      data: {
        type: input.type,
        sortOrder: input.sortOrder,
        content: input.content,
        metadata: input.metadata,
        assetId: input.assetId,
      },
    });
  }

  async deleteContentBlock(blockId: string) {
    return this.db.contentBlock.delete({ where: { id: blockId } });
  }

  async getPageBySlug(worldSlug: string, pageSlug: string): Promise<PageWithBlocks | null> {
    const world = await this.getWorldBySlug(worldSlug);
    if (!world) return null;

    const page = await this.db.page.findUnique({
      where: {
        worldId_slug: {
          worldId: world.id,
          slug: pageSlug,
        },
      },
      include: {
        contentBlocks: { orderBy: { sortOrder: "asc" } },
        campaign: true,
      },
    });

    return page ? withParsedArrays(page) : null;
  }

  async listPagesByWorld(
    worldSlug: string,
    options?: {
      campaignId?: string | null;
      type?: PageType;
      navCategory?: NavCategory;
      canonicalStatus?: CanonicalStatus | CanonicalStatus[];
    },
  ): Promise<PageSummary[]> {
    const world = await this.getWorldBySlug(worldSlug);
    if (!world) return [];

    const types = options?.navCategory
      ? pageTypesForNavCategory(options.navCategory)
      : options?.type
        ? [options.type]
        : undefined;

    const canonicalFilter = options?.canonicalStatus;
    const pages = await this.db.page.findMany({
      where: {
        worldId: world.id,
        ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
        ...(types ? { type: { in: types } } : {}),
        ...(canonicalFilter
          ? {
              canonicalStatus: Array.isArray(canonicalFilter)
                ? { in: canonicalFilter }
                : canonicalFilter,
            }
          : {}),
      },
      include: { campaign: true },
      orderBy: [{ title: "asc" }],
    });

    return pages.map((page) => withParsedArrays(page));
  }

  /**
   * World page index with an optional free-text narrowing. There used to be an
   * access-context argument here that filtered by visibility; who may read a
   * world is now decided before this call.
   */
  async listPagesForWorldIndex(
    worldSlug: string,
    options?: { campaignId?: string | null; type?: PageType; navCategory?: NavCategory; query?: string },
  ): Promise<PageSummary[]> {
    const filtered = await this.listPagesByWorld(worldSlug, {
      campaignId: options?.campaignId,
      type: options?.type,
      navCategory: options?.navCategory,
    });

    if (!options?.query?.trim()) {
      return filtered;
    }

    const q = options.query.trim().toLocaleLowerCase("de");
    return filtered.filter((page) => {
      const haystack = [
        page.title,
        page.slug,
        page.summary ?? "",
        ...parseStringArray(page.tags),
        ...parseStringArray(page.aliases),
      ]
        .join(" ")
        .toLocaleLowerCase("de");

      return haystack.includes(q);
    });
  }

  async listPagesWithBlocksForGraphUnfiltered(
    worldSlug: string,
    options?: { campaignId?: string | null; types?: PageType[] },
  ): Promise<PageWithBlocks[]> {
    const world = await this.getWorldBySlug(worldSlug);
    if (!world) return [];

    const pages = await this.db.page.findMany({
      where: {
        worldId: world.id,
        ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
        ...(options?.types?.length ? { type: { in: options.types } } : {}),
      },
      include: {
        contentBlocks: { orderBy: { sortOrder: "asc" } },
        campaign: true,
      },
      orderBy: [{ title: "asc" }],
    });

    return pages.map((page) => withParsedArrays(page));
  }

  /**
   * Cheap freshness stamp for the per-world wiki-link graph cache (H2). Combines
   * page and content-block counts + max updatedAt: content-block edits do not
   * bump page.updatedAt, so both aggregates are required to invalidate a cached
   * parsed graph on any content change. Consumed by getWorldWikiGraph.
   */
  async getWorldGraphVersion(worldSlug: string): Promise<string> {
    const [pageAgg, blockAgg] = await Promise.all([
      this.db.page.aggregate({
        where: { world: { slug: worldSlug } },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      this.db.contentBlock.aggregate({
        where: { page: { world: { slug: worldSlug } } },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
    ]);
    return [
      pageAgg._count._all,
      pageAgg._max.updatedAt?.getTime() ?? 0,
      blockAgg._count._all,
      blockAgg._max.updatedAt?.getTime() ?? 0,
    ].join(":");
  }

  async search(options: SearchOptions): Promise<SearchResultItem[]> {
    if (!options.worldSlug) {
      return searchGlobalForDm(this.db, options);
    }

    return searchForWikiContext(this.db, options);
  }

  async listWorldsWithGuestMode() {
    return this.db.world.findMany({
      where: { isSandbox: false },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
      },
    });
  }

  async getDmPage(worldSlug: string, pageSlug: string): Promise<PageWithBlocks | null> {
    return this.getPageBySlug(worldSlug, pageSlug);
  }

  async getWorldPageIndex(worldSlug: string): Promise<PageSummary[]> {
    return this.listPagesByWorld(worldSlug);
  }

  async createPageLink(input: {
    sourcePageId: string;
    targetPageId: string;
    relationType: string;
    label?: string | null;
  }) {
    return this.db.pageLink.create({
      data: {
        sourcePageId: input.sourcePageId,
        targetPageId: input.targetPageId,
        relationType: input.relationType,
        label: input.label ?? null,
      },
    });
  }

  async listPageLinksForWorld(worldSlug: string) {
    const world = await this.getWorldBySlug(worldSlug);
    if (!world) return [];

    return this.db.pageLink.findMany({
      where: {
        sourcePage: { worldId: world.id },
      },
      include: {
        sourcePage: true,
        targetPage: true,
      },
    });
  }

  async listPageLinksForPage(pageId: string): Promise<PageLinksForPage> {
    const pageSelect = {
      id: true,
      title: true,
      slug: true,
      type: true,
    } as const;

    const [outgoing, incoming] = await Promise.all([
      this.db.pageLink.findMany({
        where: { sourcePageId: pageId },
        include: {
          sourcePage: { select: pageSelect },
          targetPage: { select: pageSelect },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.db.pageLink.findMany({
        where: { targetPageId: pageId },
        include: {
          sourcePage: { select: pageSelect },
          targetPage: { select: pageSelect },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    return { outgoing, incoming };
  }

  async updatePageLink(
    id: string,
    input: {
      relationType?: string;
      label?: string | null;
    },
  ) {
    const data: Prisma.PageLinkUpdateInput = {};
    if (input.relationType !== undefined) {
      data.relationType = input.relationType;
    }
    if (input.label !== undefined) {
      data.label = input.label;
    }

    return this.db.pageLink.update({
      where: { id },
      data,
    });
  }

  async deletePageLink(id: string) {
    return this.db.pageLink.delete({
      where: { id },
    });
  }

  async getPageLinkById(id: string) {
    return this.db.pageLink.findUnique({
      where: { id },
      include: {
        sourcePage: { select: { id: true, worldId: true } },
        targetPage: { select: { id: true, worldId: true } },
      },
    });
  }

  async getPageById(pageId: string): Promise<PageWithBlocks | null> {
    const page = await this.db.page.findUnique({
      where: { id: pageId },
      include: {
        contentBlocks: { orderBy: { sortOrder: "asc" } },
        campaign: true,
      },
    });

    return page ? withParsedArrays(page) : null;
  }

  async getPageWithLinks(pageId: string) {
    return this.db.page.findUnique({
      where: { id: pageId },
      include: {
        contentBlocks: {
          orderBy: { sortOrder: "asc" },
        },
        outgoingLinks: {
          include: {
            targetPage: {
              select: { id: true, title: true, slug: true, canonicalStatus: true },
            },
          },
        },
        incomingLinks: {
          include: {
            sourcePage: {
              select: { id: true, title: true, slug: true, canonicalStatus: true },
            },
          },
        },
      },
    });
  }

  async addContentBlock(pageId: string, input: CreateContentBlockInput) {
    return this.createContentBlock(pageId, input);
  }

  async getNextContentBlockSortOrder(pageId: string): Promise<number> {
    const lastBlock = await this.db.contentBlock.findFirst({
      where: { pageId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return (lastBlock?.sortOrder ?? -1) + 1;
  }

  /** Replace editable body text blocks with a single rich_text block. */
  async replacePageBodyContent(pageId: string, content: string) {
    const page = await this.db.page.findUnique({
      where: { id: pageId },
      include: { contentBlocks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!page) throw new Error(`Seite ${pageId} nicht gefunden.`);

    const textTypes = new Set<ContentBlockType>([
      "rich_text",
      "html",
      "player_text",
      "ai_summary",
    ]);
    const textBlocks = page.contentBlocks.filter((block) => textTypes.has(block.type));
    const nonTextBlocks = page.contentBlocks.filter((block) => !textTypes.has(block.type));

    if (textBlocks.length > 0) {
      const [primary, ...rest] = textBlocks;
      await this.db.contentBlock.update({
        where: { id: primary.id },
        data: { content, type: "rich_text" },
      });
      if (rest.length > 0) {
        await this.db.contentBlock.deleteMany({
          where: { id: { in: rest.map((block) => block.id) } },
        });
      }
    } else {
      const nextSort =
        nonTextBlocks.length > 0 ? Math.min(...nonTextBlocks.map((block) => block.sortOrder)) : 0;
      await this.db.contentBlock.create({
        data: {
          pageId,
          type: "rich_text",
          sortOrder: nextSort,
          content,
        },
      });
    }

    return this.getPageById(pageId);
  }

  async createIdeaPage(input: {
    worldId: string;
    title: string;
    slug: string;
    type: PageType;
    summary?: string | null;
    content: string;
    sourcePageId?: string;
    taskType?: string;
    metadata?: Record<string, unknown>;
  }) {

    const blockMetadata = {
      source: "ai_brain",
      sourcePageId: input.sourcePageId ?? null,
      taskType: input.taskType ?? null,
      ...input.metadata,
    };

    return this.db.page.create({
      data: {
        worldId: input.worldId,
        title: input.title,
        slug: input.slug,
        type: input.type,
        summary: input.summary ?? null,
        canonicalStatus: "idea",
        contentBlocks: {
          create: [
            {
              type: "rich_text",
              sortOrder: 0,
              content: input.content,
              metadata: blockMetadata,
            },
          ],
        },
      },
      include: {
        contentBlocks: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  }

  async getDashboardStats() {
    const [worldCount, pageCount] = await Promise.all([
      this.db.world.count(),
      this.db.page.count(),
    ]);

    return { worldCount, pageCount };
  }

  /** Most recently edited pages across all worlds — for the DM dashboard. */
  async listRecentlyEditedPages(limit = 8) {
    return this.db.page.findMany({
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        world: { select: { name: true, slug: true } },
      },
    });
  }

  async getSystemSettings() {
    return this.getSettingsService().getSettingsForClient();
  }

  async updateSystemSettings(update: import("./settings-service").UweSystemSettingsUpdate) {
    return this.getSettingsService().updateSettings(update);
  }

  async listAssetsByWorld(
    worldSlug: string,
    options?: { type?: AssetType; campaignId?: string | null },
  ) {
    return listAssetsByWorld(this.db, worldSlug, options);
  }

  async getAssetById(assetId: string) {
    return getAssetById(this.db, assetId);
  }

  async createAsset(input: CreateAssetInput) {
    return createAssetRecord(this.db, input);
  }

  async updateAsset(assetId: string, input: UpdateAssetInput) {
    return updateAssetRecord(this.db, assetId, input);
  }

  async deleteAsset(assetId: string) {
    return deleteAssetRecord(this.db, assetId);
  }

  async linkAssetToPage(assetId: string, pageId: string) {
    return linkAssetToPage(this.db, assetId, pageId);
  }

  async unlinkAssetFromPage(assetId: string, pageId: string) {
    return unlinkAssetFromPage(this.db, assetId, pageId);
  }

  async linkAssetToContentBlock(blockId: string, assetId: string | null) {
    return linkAssetToContentBlock(this.db, blockId, assetId);
  }

  async listAssetsForPage(pageId: string) {
    return listAssetsForPage(this.db, pageId);
  }

  private gameSessionInclude() {
    return {
      linkedPages: {
        include: { page: true },
        orderBy: { createdAt: "asc" as const },
      },
    };
  }

  async getGameSessionById(sessionId: string) {
    return this.db.gameSession.findUnique({
      where: { id: sessionId },
      include: this.gameSessionInclude(),
    });
  }

  async findGameSessionsForPage(worldId: string, pageId: string) {
    return this.db.gameSession.findMany({
      where: {
        worldId,
        linkedPages: { some: { pageId } },
      },
      include: this.gameSessionInclude(),
      orderBy: [{ sessionNumber: "desc" }],
    });
  }

  async listGameSessionsByWorldId(worldId: string) {
    return this.db.gameSession.findMany({
      where: { worldId },
      include: this.gameSessionInclude(),
      orderBy: [{ sessionNumber: "desc" }, { date: "desc" }],
    });
  }

  async updateGameSessionPlayerRecap(sessionId: string, summaryPlayer: string) {
    const session = await this.getGameSessionById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} nicht gefunden.`);
    }

    return this.db.gameSession.update({
      where: { id: sessionId },
      data: {
        summaryPlayer,
        status: session.status === "planned" ? "played" : session.status,
      },
      include: this.gameSessionInclude(),
    });
  }
}

export function createUweRepository(databaseUrl?: string): UweRepository {
  return new UweRepository(createPrismaClient(databaseUrl));
}

export function createUweRepositoryFromClient(db: PrismaClient): UweRepository {
  return new UweRepository(db);
}

export async function createWorld(input: CreateWorldInput, databaseUrl?: string) {
  return createUweRepository(databaseUrl).createWorld(input);
}

export async function createPage(input: CreatePageInput, databaseUrl?: string) {
  return createUweRepository(databaseUrl).createPage(input);
}

export async function getPageBySlug(
  worldSlug: string,
  pageSlug: string,
  databaseUrl?: string,
) {
  return createUweRepository(databaseUrl).getPageBySlug(worldSlug, pageSlug);
}

export async function listPagesByWorld(worldSlug: string, databaseUrl?: string) {
  return createUweRepository(databaseUrl).listPagesByWorld(worldSlug);
}

export async function getDmPage(worldSlug: string, pageSlug: string, databaseUrl?: string) {
  return createUweRepository(databaseUrl).getDmPage(worldSlug, pageSlug);
}

export async function getDbWorldBySlug(worldSlug: string, databaseUrl?: string) {
  return createUweRepository(databaseUrl).getWorldBySlug(worldSlug);
}

export async function getDbPageById(pageId: string, databaseUrl?: string) {
  return createUweRepository(databaseUrl).getPageById(pageId);
}

export async function listPageLinksForPage(pageId: string, databaseUrl?: string) {
  return createUweRepository(databaseUrl).listPageLinksForPage(pageId);
}

export async function updatePageLink(
  id: string,
  input: { relationType?: string; label?: string | null },
  databaseUrl?: string,
) {
  return createUweRepository(databaseUrl).updatePageLink(id, input);
}

export async function deletePageLink(id: string, databaseUrl?: string) {
  return createUweRepository(databaseUrl).deletePageLink(id);
}

export async function getPageWithLinks(pageId: string, databaseUrl?: string) {
  return createUweRepository(databaseUrl).getPageWithLinks(pageId);
}

export async function addContentBlock(
  pageId: string,
  input: CreateContentBlockInput,
  databaseUrl?: string,
) {
  return createUweRepository(databaseUrl).addContentBlock(pageId, input);
}

export async function getNextContentBlockSortOrder(pageId: string, databaseUrl?: string) {
  return createUweRepository(databaseUrl).getNextContentBlockSortOrder(pageId);
}

export async function createIdeaPage(
  input: Parameters<UweRepository["createIdeaPage"]>[0],
  databaseUrl?: string,
) {
  return createUweRepository(databaseUrl).createIdeaPage(input);
}
