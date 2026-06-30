import {
  createAssetRecord,
  deleteAssetRecord,
  getAssetById,
  getAssetForContext,
  linkAssetToContentBlock,
  linkAssetToPage,
  listAssetsByWorld,
  listAssetsForContext,
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
  PageType,
  Prisma,
  PublishStatus,
  RevealState,
  SecretLevel,
  Visibility,
} from "./generated/prisma/client";
import { pageTypesForNavCategory, type NavCategory } from "./page-types";
import { createPrismaClient, type PrismaClient } from "./client";
import { parseStringArray, toJsonArray, withParsedArrays } from "./json-utils";
import {
  filterBlocksForContext,
  isPageAccessible,
  isPortalPageVisibility,
  isPublishedForPortal,
  PORTAL_BLOCK_VISIBILITIES,
  PORTAL_PAGE_VISIBILITIES,
  type AccessContext,
  type PortalAccessOptions,
} from "./permissions";
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
  PublishStatus,
  Visibility,
  World,
} from "./generated/prisma/client";

export {
  CanonicalStatus as CanonicalStatusEnum,
  ContentBlockType as ContentBlockTypeEnum,
  AssetType as AssetTypeEnum,
  PageType as PageTypeEnum,
  PublishStatus as PublishStatusEnum,
  RevealState as RevealStateEnum,
  SecretLevel as SecretLevelEnum,
  Visibility as VisibilityEnum,
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
  visibility?: Visibility;
  secretLevel?: SecretLevel;
  revealState?: RevealState;
  metadata?: Prisma.InputJsonValue;
  assetId?: string | null;
}

export interface CreatePageInput {
  worldId: string;
  campaignId?: string | null;
  parentPageId?: string | null;
  title: string;
  slug: string;
  type: PageType;
  summary?: string | null;
  visibility?: Visibility;
  publishStatus?: PublishStatus;
  secretLevel?: SecretLevel;
  revealState?: RevealState;
  canonicalStatus?: CanonicalStatus;
  prepStatus?: import("./generated/prisma/client").DungeonPrepStatus | null;
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
  visibility?: Visibility;
  publishStatus?: PublishStatus;
  secretLevel?: SecretLevel;
  revealState?: RevealState;
  canonicalStatus?: CanonicalStatus;
  prepStatus?: import("./generated/prisma/client").DungeonPrepStatus | null;
  tags?: string[];
  aliases?: string[];
}

export interface UpdateContentBlockInput {
  type?: ContentBlockType;
  sortOrder?: number;
  content?: string;
  visibility?: Visibility;
  secretLevel?: SecretLevel;
  revealState?: RevealState;
  metadata?: Prisma.InputJsonValue;
  assetId?: string | null;
}

export type PageWithBlocks = Prisma.PageGetPayload<{
  include: { contentBlocks: true; campaign: true };
}>;

export type PageSummary = Prisma.PageGetPayload<{
  include: { campaign: true };
}>;

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

  private async getPortalAccessOptions(): Promise<PortalAccessOptions> {
    const settings = await this.getSettingsService().getSettings();
    return {
      publicSharingEnabled: settings.portal.publicSharingEnabled,
    };
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
        title: input.title,
        slug: input.slug,
        type: input.type,
        summary: input.summary ?? null,
        visibility: input.visibility ?? defaults.defaultVisibility,
        publishStatus: input.publishStatus ?? "draft",
        secretLevel: input.secretLevel ?? "none",
        revealState: input.revealState ?? "hidden",
        canonicalStatus: input.canonicalStatus ?? defaults.defaultCanonicalStatus,
        prepStatus: input.prepStatus ?? null,
        tags: toJsonArray(input.tags),
        aliases: toJsonArray(input.aliases),
        contentBlocks: input.contentBlocks
          ? {
              create: input.contentBlocks.map((block) => ({
                type: block.type,
                sortOrder: block.sortOrder,
                content: block.content ?? "",
                visibility: block.visibility ?? "private",
                secretLevel: block.secretLevel ?? "none",
                revealState: block.revealState ?? "hidden",
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
        visibility: input.visibility,
        publishStatus: input.publishStatus,
        secretLevel: input.secretLevel,
        revealState: input.revealState,
        canonicalStatus: input.canonicalStatus,
        prepStatus: input.prepStatus,
        tags: input.tags ? toJsonArray(input.tags) : undefined,
        aliases: input.aliases ? toJsonArray(input.aliases) : undefined,
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
        visibility: input.visibility ?? "dm_only",
        secretLevel: input.secretLevel ?? "none",
        revealState: input.revealState ?? "hidden",
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
        visibility: input.visibility,
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

  async listPagesForContext(
    worldSlug: string,
    context: AccessContext,
    options?: { campaignId?: string | null; type?: PageType; navCategory?: NavCategory; query?: string },
  ): Promise<PageSummary[]> {
    const pages = await this.listPagesByWorld(worldSlug, {
      campaignId: options?.campaignId,
      type: options?.type,
      navCategory: options?.navCategory,
    });

    const portalOptions =
      context === "portal" || context === "preview"
        ? await this.getPortalAccessOptions()
        : undefined;

    const filtered = pages.filter((page) =>
      isPageAccessible(page, context, portalOptions),
    );

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

  async listPagesWithBlocksForGraph(
    worldSlug: string,
    context: AccessContext,
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

    const portalOptions =
      context === "portal" || context === "preview"
        ? await this.getPortalAccessOptions()
        : undefined;

    return pages
      .filter((page) => isPageAccessible(page, context, portalOptions))
      .map((page) => ({
        ...withParsedArrays(page),
        contentBlocks: filterBlocksForContext(page.contentBlocks, context, portalOptions),
      }));
  }

  async search(
    context: AccessContext,
    options: SearchOptions,
  ): Promise<SearchResultItem[]> {
    if (context === "dm" && !options.worldSlug) {
      return searchGlobalForDm(this.db, options);
    }

    const portalOptions =
      context === "portal" || context === "preview"
        ? await this.getPortalAccessOptions()
        : undefined;

    return searchForWikiContext(this.db, context, options, portalOptions);
  }

  async getPageForContext(
    worldSlug: string,
    pageSlug: string,
    context: AccessContext,
  ): Promise<PageWithBlocks | null> {
    const page = await this.getPageBySlug(worldSlug, pageSlug);
    if (!page) return null;

    const portalOptions =
      context === "portal" || context === "preview"
        ? await this.getPortalAccessOptions()
        : undefined;

    if (!isPageAccessible(page, context, portalOptions)) return null;

    return {
      ...page,
      contentBlocks: filterBlocksForContext(page.contentBlocks, context, portalOptions),
    };
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
        guestModeEnabled: true,
      },
    });
  }

  async getPublicPageForPortal(
    worldSlug: string,
    pageSlug: string,
  ): Promise<PublicPage | null> {
    return this.getPageForContext(worldSlug, pageSlug, "portal");
  }

  async getDmPage(worldSlug: string, pageSlug: string): Promise<PageWithBlocks | null> {
    return this.getPageBySlug(worldSlug, pageSlug);
  }

  async getWorldPageIndex(worldSlug: string): Promise<PageSummary[]> {
    return this.listPagesByWorld(worldSlug);
  }

  async getWorldPageIndexForContext(
    worldSlug: string,
    context: AccessContext,
  ): Promise<PageSummary[]> {
    return this.listPagesForContext(worldSlug, context);
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
              select: { id: true, title: true, slug: true, visibility: true, canonicalStatus: true },
            },
          },
        },
        incomingLinks: {
          include: {
            sourcePage: {
              select: { id: true, title: true, slug: true, visibility: true, canonicalStatus: true },
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

  async createIdeaPage(input: {
    worldId: string;
    title: string;
    slug: string;
    type: PageType;
    summary?: string | null;
    content: string;
    sourcePageId?: string;
    taskType?: string;
    visibility?: Visibility;
    metadata?: Record<string, unknown>;
  }) {
    const defaults = await this.getSettingsService().getWorldDefaults();

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
        visibility: input.visibility ?? defaults.defaultVisibility,
        publishStatus: "draft",
        canonicalStatus: "idea",
        contentBlocks: {
          create: [
            {
              type: "rich_text",
              sortOrder: 0,
              content: input.content,
              visibility: input.visibility ?? "dm_only",
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
    const [worldCount, pageCount, publishedCount, draftCount] = await Promise.all([
      this.db.world.count(),
      this.db.page.count(),
      this.db.page.count({ where: { publishStatus: "published" } }),
      this.db.page.count({ where: { publishStatus: "draft" } }),
    ]);

    return { worldCount, pageCount, publishedCount, draftCount };
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

  async listAssetsForContext(
    worldSlug: string,
    context: AccessContext,
    options?: { type?: AssetType },
  ) {
    return listAssetsForContext(this.db, worldSlug, context, options);
  }

  async getAssetForContext(assetId: string, context: AccessContext) {
    return getAssetForContext(this.db, assetId, context);
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

export async function getPublicPageForPortal(
  worldSlug: string,
  pageSlug: string,
  databaseUrl?: string,
) {
  return createUweRepository(databaseUrl).getPublicPageForPortal(worldSlug, pageSlug);
}

export async function getDmPage(worldSlug: string, pageSlug: string, databaseUrl?: string) {
  return createUweRepository(databaseUrl).getDmPage(worldSlug, pageSlug);
}

export { PORTAL_BLOCK_VISIBILITIES, PORTAL_PAGE_VISIBILITIES, isPortalPageVisibility, isPublishedForPortal };

export async function getDbWorldBySlug(worldSlug: string, databaseUrl?: string) {
  return createUweRepository(databaseUrl).getWorldBySlug(worldSlug);
}

export async function getDbPageById(pageId: string, databaseUrl?: string) {
  return createUweRepository(databaseUrl).getPageById(pageId);
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
