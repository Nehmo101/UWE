import type {
  Asset,
  ContentBlock,
  DungeonPrepStatus,
  PageType,
  Prisma,
} from "./generated/prisma/client";
import { createPrismaClient, type PrismaClient } from "./client";
import { withParsedArrays } from "./json-utils";
import { slugifyDe } from "./slug-utils";
import { renderPageContentHtml, type WikiPageNode } from "./page-service";
import { filterBlocksForContext } from "./permissions";
import type { PageSummary } from "./repository";

export type {
  DungeonPrepStatus,
} from "./generated/prisma/client";

export {
  DungeonPrepStatus as DungeonPrepStatusEnum,
} from "./generated/prisma/client";

export const DUNGEON_PREP_STATUS_LABELS: Record<DungeonPrepStatus, string> = {
  unprepared: "Unvorbereitet",
  ready: "Bereit",
  played: "Gespielt",
  skipped: "Übersprungen",
};

export const DUNGEON_ROOT_TYPE = "dungeon" as const;
export const DUNGEON_LEVEL_TYPE = "dungeon_level" as const;
export const DUNGEON_ROOM_TYPE = "room" as const;

export const ROOM_CHILD_TYPES = [
  "encounter",
  "trap",
  "puzzle",
  "loot",
  "secret",
  "handout",
  "map",
] as const satisfies readonly PageType[];

export type RoomChildType = (typeof ROOM_CHILD_TYPES)[number];

export const DUNGEON_PAGE_TYPES = [
  DUNGEON_ROOT_TYPE,
  DUNGEON_LEVEL_TYPE,
  DUNGEON_ROOM_TYPE,
  ...ROOM_CHILD_TYPES,
] as const satisfies readonly PageType[];

const DUNGEON_CHILD_TYPES: PageType[] = [DUNGEON_LEVEL_TYPE];

export interface CreateDungeonEntityInput {
  worldId: string;
  campaignId?: string | null;
  parentPageId?: string | null;
  title: string;
  slug: string;
  type: PageType;
  summary?: string | null;
  visibility?: Prisma.PageCreateInput["visibility"];
  prepStatus?: DungeonPrepStatus;
  contentBlocks?: Array<{
    type: Prisma.ContentBlockCreateInput["type"];
    sortOrder: number;
    content?: string;
    visibility?: Prisma.ContentBlockCreateInput["visibility"];
  }>;
}

export interface UpdateDungeonEntityInput {
  title?: string;
  slug?: string;
  summary?: string | null;
  visibility?: Prisma.PageUpdateInput["visibility"];
  prepStatus?: DungeonPrepStatus | null;
}

export type DungeonPageWithBlocks = Prisma.PageGetPayload<{
  include: {
    contentBlocks: { orderBy: { sortOrder: "asc" } };
    campaign: true;
    assetPageLinks: { include: { asset: true } };
  };
}>;

export interface DungeonEntitySummary {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  summary: string | null;
  visibility: Prisma.PageGetPayload<object>["visibility"];
  prepStatus: DungeonPrepStatus | null;
  parentPageId: string | null;
  tags: string[];
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomContentSections {
  readAloud: ContentBlock[];
  dmNotes: ContentBlock[];
  playerDescription: ContentBlock[];
  otherBlocks: ContentBlock[];
}

export interface DmRoomCockpitView {
  room: DungeonEntitySummary;
  level: DungeonEntitySummary;
  dungeon: DungeonEntitySummary;
  encounters: DungeonEntitySummary[];
  traps: DungeonEntitySummary[];
  puzzles: DungeonEntitySummary[];
  loot: DungeonEntitySummary[];
  secrets: DungeonEntitySummary[];
  handouts: DungeonEntitySummary[];
  maps: DungeonEntitySummary[];
  assets: Asset[];
  sections: RoomContentSections;
  html: string;
}

/** Portal view — DM-only blocks and fields are never included. */
export interface PortalRoomCockpitView {
  room: Pick<
    DungeonEntitySummary,
    "id" | "title" | "slug" | "type" | "summary" | "prepStatus"
  >;
  playerDescription: ContentBlock[];
  readAloud: ContentBlock[];
  handouts: DungeonEntitySummary[];
  maps: DungeonEntitySummary[];
  assets: Asset[];
  html: string;
}

export interface DmDungeonOverview {
  dungeon: DungeonEntitySummary;
  levels: DungeonEntitySummary[];
  assets: Asset[];
  html: string;
}

export interface DmLevelOverview {
  dungeon: DungeonEntitySummary;
  level: DungeonEntitySummary;
  rooms: DungeonEntitySummary[];
}

function slugifyTitle(title: string): string {
  return slugifyDe(title, { maxLength: 80, fallback: "entity" });
}

function toEntitySummary(page: Prisma.PageGetPayload<{ include: { campaign: true } }>): DungeonEntitySummary {
  const parsed = withParsedArrays(page);
  return {
    id: parsed.id,
    title: parsed.title,
    slug: parsed.slug,
    type: parsed.type,
    summary: parsed.summary,
    visibility: parsed.visibility,
    prepStatus: parsed.prepStatus,
    parentPageId: parsed.parentPageId,
    tags: parsed.tags,
    aliases: parsed.aliases,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  };
}

export function categorizeRoomBlocks(blocks: ContentBlock[]): RoomContentSections {
  const sorted = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);
  const readAloud: ContentBlock[] = [];
  const dmNotes: ContentBlock[] = [];
  const playerDescription: ContentBlock[] = [];
  const otherBlocks: ContentBlock[] = [];

  for (const block of sorted) {
    if (block.type === "player_text") {
      readAloud.push(block);
    } else if (block.type === "gm_note") {
      dmNotes.push(block);
    } else if (
      block.type === "rich_text" &&
      (block.visibility === "player_visible" || block.visibility === "public")
    ) {
      playerDescription.push(block);
    } else {
      otherBlocks.push(block);
    }
  }

  return { readAloud, dmNotes, playerDescription, otherBlocks };
}

export function filterRoomChildren(
  pages: Prisma.PageGetPayload<{ include: { campaign: true } }>[],
): Record<RoomChildType, DungeonEntitySummary[]> {
  const result = Object.fromEntries(
    ROOM_CHILD_TYPES.map((type) => [type, [] as DungeonEntitySummary[]]),
  ) as Record<RoomChildType, DungeonEntitySummary[]>;

  for (const page of pages) {
    if (ROOM_CHILD_TYPES.includes(page.type as RoomChildType)) {
      result[page.type as RoomChildType].push(toEntitySummary(page));
    }
  }

  for (const type of ROOM_CHILD_TYPES) {
    result[type].sort((a, b) => a.title.localeCompare(b.title, "de"));
  }

  return result;
}

export function toPortalRoomCockpitView(
  room: DungeonPageWithBlocks,
  children: Prisma.PageGetPayload<{ include: { campaign: true } }>[],
  worldSlug: string,
  wikiIndex: WikiPageNode[],
): PortalRoomCockpitView {
  const visibleBlocks = filterBlocksForContext(room.contentBlocks, "portal");
  const sections = categorizeRoomBlocks(visibleBlocks);
  const childGroups = filterRoomChildren(
    children.filter((child) => child.visibility !== "dm_only"),
  );
  const visibleAssets = room.assetPageLinks
    .map((link) => link.asset)
    .filter((asset) => asset.visibility === "player_visible" || asset.visibility === "public");

  return {
    room: {
      id: room.id,
      title: room.title,
      slug: room.slug,
      type: room.type,
      summary: room.summary,
      prepStatus: room.prepStatus,
    },
    playerDescription: sections.playerDescription,
    readAloud: sections.readAloud,
    handouts: childGroups.handout,
    maps: childGroups.map,
    assets: visibleAssets,
    html: renderPageContentHtml(worldSlug, { ...room, contentBlocks: visibleBlocks }, wikiIndex, "portal"),
  };
}

export class DungeonCockpitService {
  constructor(private readonly db: PrismaClient) {}

  private pageInclude() {
    return {
      campaign: true,
      contentBlocks: { orderBy: { sortOrder: "asc" as const } },
      assetPageLinks: { include: { asset: true } },
    };
  }

  async listDungeons(
    worldSlug: string,
    options?: { campaignId?: string | null },
  ): Promise<DungeonEntitySummary[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    const pages = await this.db.page.findMany({
      where: {
        worldId: world.id,
        type: DUNGEON_ROOT_TYPE,
        ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
      },
      include: { campaign: true },
      orderBy: { title: "asc" },
    });

    return pages.map(toEntitySummary);
  }

  async getDungeonOverview(
    worldSlug: string,
    dungeonSlug: string,
    wikiIndex: WikiPageNode[],
  ): Promise<DmDungeonOverview | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    const dungeon = await this.db.page.findFirst({
      where: { worldId: world.id, slug: dungeonSlug, type: DUNGEON_ROOT_TYPE },
      include: this.pageInclude(),
    });
    if (!dungeon) return null;

    const levels = await this.db.page.findMany({
      where: {
        worldId: world.id,
        parentPageId: dungeon.id,
        type: { in: DUNGEON_CHILD_TYPES },
      },
      include: { campaign: true },
      orderBy: { title: "asc" },
    });

    return {
      dungeon: toEntitySummary(dungeon),
      levels: levels.map(toEntitySummary),
      assets: dungeon.assetPageLinks.map((link) => link.asset),
      html: renderPageContentHtml(worldSlug, dungeon, wikiIndex, "dm"),
    };
  }

  async getLevelOverview(
    worldSlug: string,
    dungeonSlug: string,
    levelSlug: string,
  ): Promise<DmLevelOverview | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    const dungeon = await this.db.page.findFirst({
      where: { worldId: world.id, slug: dungeonSlug, type: DUNGEON_ROOT_TYPE },
      include: { campaign: true },
    });
    if (!dungeon) return null;

    const level = await this.db.page.findFirst({
      where: {
        worldId: world.id,
        slug: levelSlug,
        type: DUNGEON_LEVEL_TYPE,
        parentPageId: dungeon.id,
      },
      include: { campaign: true },
    });
    if (!level) return null;

    const rooms = await this.db.page.findMany({
      where: {
        worldId: world.id,
        parentPageId: level.id,
        type: DUNGEON_ROOM_TYPE,
      },
      include: { campaign: true },
      orderBy: { title: "asc" },
    });

    return {
      dungeon: toEntitySummary(dungeon),
      level: toEntitySummary(level),
      rooms: rooms.map(toEntitySummary),
    };
  }

  async getRoomCockpit(
    worldSlug: string,
    dungeonSlug: string,
    levelSlug: string,
    roomSlug: string,
    wikiIndex: WikiPageNode[],
  ): Promise<
    | (DmRoomCockpitView & {
        level: DungeonEntitySummary;
        dungeon: DungeonEntitySummary;
      })
    | null
  > {
    const levelOverview = await this.getLevelOverview(worldSlug, dungeonSlug, levelSlug);
    if (!levelOverview) return null;

    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    const room = await this.db.page.findFirst({
      where: {
        worldId: world.id,
        slug: roomSlug,
        type: DUNGEON_ROOM_TYPE,
        parentPageId: levelOverview.level.id,
      },
      include: this.pageInclude(),
    });
    if (!room) return null;

    const children = await this.db.page.findMany({
      where: {
        worldId: world.id,
        parentPageId: room.id,
        type: { in: [...ROOM_CHILD_TYPES] },
      },
      include: { campaign: true },
      orderBy: { title: "asc" },
    });

    const childGroups = filterRoomChildren(children);

    return {
      room: toEntitySummary(room),
      level: levelOverview.level,
      dungeon: levelOverview.dungeon,
      encounters: childGroups.encounter,
      traps: childGroups.trap,
      puzzles: childGroups.puzzle,
      loot: childGroups.loot,
      secrets: childGroups.secret,
      handouts: childGroups.handout,
      maps: childGroups.map,
      assets: room.assetPageLinks.map((link) => link.asset),
      sections: categorizeRoomBlocks(room.contentBlocks),
      html: renderPageContentHtml(worldSlug, room, wikiIndex, "dm"),
    };
  }

  async getRoomForPortal(
    worldSlug: string,
    roomSlug: string,
    wikiIndex: WikiPageNode[],
  ): Promise<PortalRoomCockpitView | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    const room = await this.db.page.findFirst({
      where: {
        worldId: world.id,
        slug: roomSlug,
        type: DUNGEON_ROOM_TYPE,
        visibility: { in: ["player_visible", "public"] },
      },
      include: this.pageInclude(),
    });
    if (!room) return null;

    const children = await this.db.page.findMany({
      where: {
        worldId: world.id,
        parentPageId: room.id,
        type: { in: [...ROOM_CHILD_TYPES] },
        visibility: { in: ["player_visible", "public"] },
      },
      include: { campaign: true },
    });

    return toPortalRoomCockpitView(room, children, worldSlug, wikiIndex);
  }

  async createEntity(input: CreateDungeonEntityInput): Promise<DungeonPageWithBlocks> {
    return this.db.page.create({
      data: {
        worldId: input.worldId,
        campaignId: input.campaignId ?? null,
        parentPageId: input.parentPageId ?? null,
        title: input.title,
        slug: input.slug,
        type: input.type,
        summary: input.summary ?? null,
        visibility: input.visibility ?? "dm_only",
        prepStatus: input.prepStatus ?? "unprepared",
        contentBlocks: input.contentBlocks
          ? {
              create: input.contentBlocks.map((block) => ({
                type: block.type,
                sortOrder: block.sortOrder,
                content: block.content ?? "",
                visibility: block.visibility ?? "dm_only",
              })),
            }
          : undefined,
      },
      include: this.pageInclude(),
    });
  }

  async updateEntity(pageId: string, input: UpdateDungeonEntityInput): Promise<DungeonPageWithBlocks> {
    return this.db.page.update({
      where: { id: pageId },
      data: {
        title: input.title,
        slug: input.slug,
        summary: input.summary,
        visibility: input.visibility,
        prepStatus: input.prepStatus,
      },
      include: this.pageInclude(),
    });
  }

  async createWithGeneratedSlug(
    input: Omit<CreateDungeonEntityInput, "slug"> & { slug?: string },
  ): Promise<DungeonPageWithBlocks> {
    const baseSlug = input.slug ?? slugifyTitle(input.title);
    let slug = baseSlug;
    let suffix = 2;

    while (
      await this.db.page.findFirst({
        where: { worldId: input.worldId, slug },
        select: { id: true },
      })
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return this.createEntity({ ...input, slug });
  }

  async linkAsset(pageId: string, assetId: string) {
    return this.db.assetPageLink.upsert({
      where: { assetId_pageId: { assetId, pageId } },
      create: { assetId, pageId },
      update: {},
    });
  }

  async getPageById(pageId: string): Promise<PageSummary | null> {
    return this.db.page.findUnique({
      where: { id: pageId },
      include: { campaign: true },
    });
  }
}

export function createDungeonCockpitService(databaseUrl?: string): DungeonCockpitService {
  return new DungeonCockpitService(createPrismaClient(databaseUrl));
}

export function suggestSlugFromTitle(title: string): string {
  return slugifyTitle(title);
}
