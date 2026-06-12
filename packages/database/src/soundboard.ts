import {
  extractYouTubeVideoId,
  fetchSpotifyCoverUrl,
  getCachedSpotifyCoverUrl,
  getYouTubeThumbnailUrl,
  type SpotifyCoverFetchOptions,
} from "@uwe/soundboard";
import type { Prisma, SoundSourceType, Visibility } from "./generated/prisma/client";
import { createPrismaClient, type PrismaClient } from "./client";
import { parseStringArray, toJsonArray } from "./json-utils";
import type { PageSummary } from "./repository";
import { isPortalAssetVisibility } from "./permissions";

export { extractYouTubeVideoId } from "@uwe/soundboard";

export type { SoundSourceType } from "./generated/prisma/client";

export { SoundSourceType as SoundSourceTypeEnum } from "./generated/prisma/client";

export interface CreateSoundboardButtonInput {
  worldId: string;
  campaignId?: string | null;
  title: string;
  sourceType: SoundSourceType;
  sourceUrl?: string | null;
  assetId?: string | null;
  thumbnail?: string | null;
  volume?: number;
  loop?: boolean;
  tags?: string[];
  visibility?: Visibility;
  sortOrder?: number;
  linkedPageIds?: string[];
}

export interface UpdateSoundboardButtonInput {
  title?: string;
  campaignId?: string | null;
  sourceType?: SoundSourceType;
  sourceUrl?: string | null;
  assetId?: string | null;
  thumbnail?: string | null;
  volume?: number;
  loop?: boolean;
  tags?: string[];
  visibility?: Visibility;
  sortOrder?: number;
  linkedPageIds?: string[];
}

export type SoundboardButtonWithLinks = Prisma.SoundboardButtonGetPayload<{
  include: {
    campaign: true;
    asset: true;
    linkedPages: {
      include: {
        page: {
          include: { campaign: true };
        };
      };
    };
  };
}>;

export interface PortalSoundboardButtonView {
  id: string;
  worldId: string;
  campaignId: string | null;
  title: string;
  sourceType: SoundSourceType;
  sourceUrl: string | null;
  assetId: string | null;
  thumbnail: string | null;
  volume: number;
  loop: boolean;
  tags: string[];
  visibility: Visibility;
  sortOrder: number;
  linkedPages: PageSummary[];
  createdAt: Date;
  updatedAt: Date;
}

export type DmSoundboardButtonView = PortalSoundboardButtonView;

function withParsedPageArrays<T extends { tags: unknown; aliases: unknown }>(page: T) {
  return {
    ...page,
    tags: parseStringArray(page.tags),
    aliases: parseStringArray(page.aliases),
  };
}

function mapLinkedPages(button: SoundboardButtonWithLinks): PageSummary[] {
  return button.linkedPages.map((link) => withParsedPageArrays(link.page));
}

export function toDmSoundboardButtonView(button: SoundboardButtonWithLinks): DmSoundboardButtonView {
  return {
    id: button.id,
    worldId: button.worldId,
    campaignId: button.campaignId,
    title: button.title,
    sourceType: button.sourceType,
    sourceUrl: button.sourceUrl,
    assetId: button.assetId,
    thumbnail: resolveThumbnail(button),
    volume: button.volume,
    loop: button.loop,
    tags: parseStringArray(button.tags),
    visibility: button.visibility,
    sortOrder: button.sortOrder,
    linkedPages: mapLinkedPages(button),
    createdAt: button.createdAt,
    updatedAt: button.updatedAt,
  };
}

/** Portal view uses the same fields — DM-only buttons are filtered before mapping. */
export function toPortalSoundboardButtonView(
  button: SoundboardButtonWithLinks,
): PortalSoundboardButtonView {
  return toDmSoundboardButtonView(button);
}

export function resolveThumbnail(button: SoundboardButtonWithLinks): string | null {
  if (button.thumbnail) {
    return button.thumbnail;
  }

  if (button.asset?.type === "audio" || button.asset?.type === "image") {
    const metadata = button.asset.metadata;
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      const thumb = (metadata as Record<string, unknown>).thumbnailUrl;
      if (typeof thumb === "string" && thumb.length > 0) {
        return thumb;
      }
    }
  }

  if (button.sourceType === "youtube" && button.sourceUrl) {
    const videoId = extractYouTubeVideoId(button.sourceUrl);
    if (videoId) {
      return getYouTubeThumbnailUrl(videoId);
    }
  }

  if (button.sourceType === "spotify" && button.sourceUrl) {
    const cached = getCachedSpotifyCoverUrl(button.sourceUrl);
    if (cached) {
      return cached;
    }
  }

  return null;
}

function readSpotifyCoverOptionsFromEnv(): SpotifyCoverFetchOptions {
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID ?? null,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? null,
  };
}

async function resolveSpotifyThumbnailForWrite(
  sourceType: SoundSourceType,
  sourceUrl: string | null | undefined,
  thumbnail: string | null | undefined,
  spotifyCoverOptions?: SpotifyCoverFetchOptions,
): Promise<string | null> {
  const explicit = thumbnail?.trim();
  if (explicit) {
    return explicit;
  }

  if (sourceType !== "spotify" || !sourceUrl?.trim()) {
    return null;
  }

  return (
    await fetchSpotifyCoverUrl(sourceUrl, spotifyCoverOptions ?? readSpotifyCoverOptionsFromEnv())
  );
}

export function isSoundboardButtonVisibleInPortal(visibility: Visibility): boolean {
  return isPortalAssetVisibility(visibility);
}

export interface SoundboardServiceOptions {
  spotifyCoverOptions?: SpotifyCoverFetchOptions;
}

export class SoundboardService {
  constructor(
    private readonly db: PrismaClient,
    private readonly options: SoundboardServiceOptions = {},
  ) {}

  private buttonInclude() {
    return {
      campaign: true,
      asset: true,
      linkedPages: {
        include: {
          page: {
            include: { campaign: true },
          },
        },
        orderBy: { createdAt: "asc" as const },
      },
    };
  }

  async listByWorld(
    worldSlug: string,
    options?: { campaignId?: string | null },
  ): Promise<SoundboardButtonWithLinks[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    return this.db.soundboardButton.findMany({
      where: {
        worldId: world.id,
        ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
      },
      include: this.buttonInclude(),
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
  }

  async listForPortal(
    worldSlug: string,
    options?: { campaignId?: string | null },
  ): Promise<SoundboardButtonWithLinks[]> {
    const buttons = await this.listByWorld(worldSlug, options);
    return buttons.filter((button) => isSoundboardButtonVisibleInPortal(button.visibility));
  }

  async getById(buttonId: string): Promise<SoundboardButtonWithLinks | null> {
    return this.db.soundboardButton.findUnique({
      where: { id: buttonId },
      include: this.buttonInclude(),
    });
  }

  async getByIdForWorld(
    worldSlug: string,
    buttonId: string,
  ): Promise<SoundboardButtonWithLinks | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    return this.db.soundboardButton.findFirst({
      where: { id: buttonId, worldId: world.id },
      include: this.buttonInclude(),
    });
  }

  async getNextSortOrder(worldId: string, campaignId?: string | null): Promise<number> {
    const last = await this.db.soundboardButton.findFirst({
      where: {
        worldId,
        ...(campaignId ? { campaignId } : {}),
      },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    return (last?.sortOrder ?? -1) + 1;
  }

  async create(input: CreateSoundboardButtonInput): Promise<SoundboardButtonWithLinks> {
    const linkedPageIds = input.linkedPageIds ?? [];
    const thumbnail = await resolveSpotifyThumbnailForWrite(
      input.sourceType,
      input.sourceUrl,
      input.thumbnail,
      this.options.spotifyCoverOptions,
    );

    return this.db.soundboardButton.create({
      data: {
        worldId: input.worldId,
        campaignId: input.campaignId ?? null,
        title: input.title,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl ?? null,
        assetId: input.assetId ?? null,
        thumbnail,
        volume: input.volume ?? 1.0,
        loop: input.loop ?? false,
        tags: toJsonArray(input.tags ?? []),
        visibility: input.visibility ?? "dm_only",
        sortOrder: input.sortOrder ?? 0,
        linkedPages: linkedPageIds.length
          ? {
              create: linkedPageIds.map((pageId) => ({ pageId })),
            }
          : undefined,
      },
      include: this.buttonInclude(),
    });
  }

  async update(
    buttonId: string,
    input: UpdateSoundboardButtonInput,
  ): Promise<SoundboardButtonWithLinks> {
    const existing = await this.db.soundboardButton.findUnique({
      where: { id: buttonId },
      select: { sourceType: true, sourceUrl: true, thumbnail: true },
    });

    const sourceType = input.sourceType ?? existing?.sourceType ?? "local";
    const sourceUrl = input.sourceUrl ?? existing?.sourceUrl ?? null;
    const thumbnailInput =
      input.thumbnail !== undefined ? input.thumbnail : existing?.thumbnail ?? null;
    const thumbnail = await resolveSpotifyThumbnailForWrite(
      sourceType,
      sourceUrl,
      thumbnailInput,
      this.options.spotifyCoverOptions,
    );

    if (input.linkedPageIds) {
      await this.db.soundboardButtonPageLink.deleteMany({
        where: { soundboardButtonId: buttonId },
      });

      if (input.linkedPageIds.length > 0) {
        await this.db.soundboardButtonPageLink.createMany({
          data: input.linkedPageIds.map((pageId) => ({
            soundboardButtonId: buttonId,
            pageId,
          })),
        });
      }
    }

    return this.db.soundboardButton.update({
      where: { id: buttonId },
      data: {
        title: input.title,
        campaignId: input.campaignId,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        assetId: input.assetId,
        thumbnail: input.thumbnail !== undefined ? thumbnail : undefined,
        volume: input.volume,
        loop: input.loop,
        tags: input.tags ? toJsonArray(input.tags) : undefined,
        visibility: input.visibility,
        sortOrder: input.sortOrder,
      },
      include: this.buttonInclude(),
    });
  }

  async delete(buttonId: string) {
    return this.db.soundboardButton.delete({ where: { id: buttonId } });
  }

  async linkPage(buttonId: string, pageId: string) {
    return this.db.soundboardButtonPageLink.upsert({
      where: {
        soundboardButtonId_pageId: {
          soundboardButtonId: buttonId,
          pageId,
        },
      },
      create: { soundboardButtonId: buttonId, pageId },
      update: {},
    });
  }

  async unlinkPage(buttonId: string, pageId: string) {
    return this.db.soundboardButtonPageLink.deleteMany({
      where: { soundboardButtonId: buttonId, pageId },
    });
  }

  async listByLinkedPage(pageId: string): Promise<SoundboardButtonWithLinks[]> {
    return this.db.soundboardButton.findMany({
      where: {
        linkedPages: {
          some: { pageId },
        },
      },
      include: this.buttonInclude(),
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
  }
}

export function createSoundboardService(
  databaseUrl?: string,
  options?: SoundboardServiceOptions,
): SoundboardService {
  return new SoundboardService(createPrismaClient(databaseUrl), options);
}
