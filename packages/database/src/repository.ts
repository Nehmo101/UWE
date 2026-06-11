import type {
  CanonicalStatus,
  ContentBlockType,
  PageType,
  Prisma,
  PublishStatus,
  Visibility,
} from "./generated/prisma/client";
import { createPrismaClient, type PrismaClient } from "./client";

export type {
  Campaign,
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
  PageType as PageTypeEnum,
  PublishStatus as PublishStatusEnum,
  Visibility as VisibilityEnum,
} from "./generated/prisma/client";

export interface CreateWorldInput {
  name: string;
  slug: string;
  description?: string | null;
}

export interface CreateContentBlockInput {
  type: ContentBlockType;
  sortOrder: number;
  content?: string;
  visibility?: Visibility;
  metadata?: Prisma.InputJsonValue;
}

export interface CreatePageInput {
  worldId: string;
  campaignId?: string | null;
  title: string;
  slug: string;
  type: PageType;
  summary?: string | null;
  visibility?: Visibility;
  publishStatus?: PublishStatus;
  canonicalStatus?: CanonicalStatus;
  tags?: string[];
  aliases?: string[];
  contentBlocks?: CreateContentBlockInput[];
}

export type PageWithBlocks = Prisma.PageGetPayload<{
  include: { contentBlocks: true };
}>;

export type PublicPage = PageWithBlocks;

const PORTAL_PAGE_VISIBILITIES: Visibility[] = ["public", "player_visible"];
const PORTAL_BLOCK_VISIBILITIES: Visibility[] = ["public", "player_visible"];

function normalizeStringArray(value: string[] | undefined): string[] {
  return value ?? [];
}

function sortBlocks<T extends { sortOrder: number }>(blocks: T[]): T[] {
  return [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);
}

export class UweRepository {
  constructor(private readonly db: PrismaClient) {}

  async createWorld(input: CreateWorldInput) {
    return this.db.world.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
      },
    });
  }

  async createPage(input: CreatePageInput) {
    return this.db.page.create({
      data: {
        worldId: input.worldId,
        campaignId: input.campaignId ?? null,
        title: input.title,
        slug: input.slug,
        type: input.type,
        summary: input.summary ?? null,
        visibility: input.visibility ?? "dm_only",
        publishStatus: input.publishStatus ?? "draft",
        canonicalStatus: input.canonicalStatus ?? "draft",
        tags: normalizeStringArray(input.tags),
        aliases: normalizeStringArray(input.aliases),
        contentBlocks: input.contentBlocks
          ? {
              create: input.contentBlocks.map((block) => ({
                type: block.type,
                sortOrder: block.sortOrder,
                content: block.content ?? "",
                visibility: block.visibility ?? "dm_only",
                metadata: block.metadata ?? {},
              })),
            }
          : undefined,
      },
      include: {
        contentBlocks: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  }

  async getPageBySlug(worldSlug: string, pageSlug: string): Promise<PageWithBlocks | null> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });

    if (!world) {
      return null;
    }

    return this.db.page.findUnique({
      where: {
        worldId_slug: {
          worldId: world.id,
          slug: pageSlug,
        },
      },
      include: {
        contentBlocks: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  }

  async listPagesByWorld(worldSlug: string) {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });

    if (!world) {
      return [];
    }

    return this.db.page.findMany({
      where: { worldId: world.id },
      orderBy: [{ title: "asc" }],
    });
  }

  async getPublicPageForPortal(
    worldSlug: string,
    pageSlug: string,
  ): Promise<PublicPage | null> {
    const page = await this.getPageBySlug(worldSlug, pageSlug);

    if (!page) {
      return null;
    }

    if (page.publishStatus !== "published") {
      return null;
    }

    if (!PORTAL_PAGE_VISIBILITIES.includes(page.visibility)) {
      return null;
    }

    return {
      ...page,
      contentBlocks: sortBlocks(
        page.contentBlocks.filter((block) =>
          PORTAL_BLOCK_VISIBILITIES.includes(block.visibility),
        ),
      ),
    };
  }

  async getDmPage(worldSlug: string, pageSlug: string): Promise<PageWithBlocks | null> {
    return this.getPageBySlug(worldSlug, pageSlug);
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
}

export function createUweRepository(databaseUrl?: string): UweRepository {
  return new UweRepository(createPrismaClient(databaseUrl));
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
