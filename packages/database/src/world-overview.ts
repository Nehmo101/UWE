import type { PrismaClient } from "./client";
import type {
  GameSessionStatus,
  PageType,
  PublishStatus,
  Visibility,
} from "./generated/prisma/client";
import { navCategoryForPageType, type NavCategory } from "./page-types";
import { isPageAccessible } from "./permissions";
import { SettingsService } from "./settings-service";

/**
 * World Overview: aggregates everything a DM needs at a glance for one world.
 * Read-only — built entirely from existing data.
 */

export interface WorldOverviewPage {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  visibility: Visibility;
  publishStatus: PublishStatus;
  updatedAt: Date;
}

export interface WorldOverviewSession {
  id: string;
  title: string;
  sessionNumber: number;
  date: Date | null;
  status: GameSessionStatus;
}

export interface WorldOverviewOpenPlot {
  sessionId: string;
  sessionTitle: string;
  sessionNumber: number;
  openPlots: string;
}

export interface WorldOverviewData {
  world: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    guestModeEnabled: boolean;
  };
  counts: {
    pages: number;
    byCategory: Record<NavCategory, number>;
    published: number;
    drafts: number;
    campaigns: number;
    assets: number;
    gameSessions: number;
  };
  portal: {
    portalEnabled: boolean;
    publicSharingEnabled: boolean;
    visiblePageCount: number;
  };
  nextSession: WorldOverviewSession | null;
  openPlots: WorldOverviewOpenPlot[];
  recentPages: WorldOverviewPage[];
  playerNotesForReview: number;
}

const EMPTY_CATEGORY_COUNTS: Record<NavCategory, number> = {
  lore: 0,
  orte: 0,
  npcs: 0,
  fraktionen: 0,
  sessions: 0,
  handouts: 0,
  karten: 0,
};

export class WorldOverviewService {
  constructor(private readonly db: PrismaClient) {}

  async getWorldOverview(worldSlug: string): Promise<WorldOverviewData | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    const settings = await new SettingsService(this.db).getSettings();

    const [pages, campaignCount, assetCount, gameSessions, notesForReview] =
      await Promise.all([
        this.db.page.findMany({
          where: { worldId: world.id },
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
            visibility: true,
            publishStatus: true,
            updatedAt: true,
          },
        }),
        this.db.campaign.count({ where: { worldId: world.id } }),
        this.db.asset.count({ where: { worldId: world.id } }),
        this.db.gameSession.findMany({
          where: { worldId: world.id },
          select: {
            id: true,
            title: true,
            sessionNumber: true,
            date: true,
            status: true,
            openPlots: true,
          },
          orderBy: [{ sessionNumber: "desc" }],
        }),
        this.db.playerNote.count({
          where: { worldId: world.id, status: "visible_to_dm" },
        }),
      ]);

    const byCategory: Record<NavCategory, number> = { ...EMPTY_CATEGORY_COUNTS };
    let published = 0;
    let drafts = 0;
    let visiblePageCount = 0;

    const portalOptions = {
      publicSharingEnabled: settings.portal.publicSharingEnabled,
    };

    for (const page of pages) {
      byCategory[navCategoryForPageType(page.type)] += 1;
      if (page.publishStatus === "published") published += 1;
      if (page.publishStatus === "draft") drafts += 1;
      if (isPageAccessible(page, "portal", portalOptions)) visiblePageCount += 1;
    }

    const upcoming = gameSessions
      .filter((session) => session.status === "planned" || session.status === "prepared")
      .sort((a, b) => a.sessionNumber - b.sessionNumber);

    const nextSession = upcoming[0]
      ? {
          id: upcoming[0].id,
          title: upcoming[0].title,
          sessionNumber: upcoming[0].sessionNumber,
          date: upcoming[0].date,
          status: upcoming[0].status,
        }
      : null;

    const openPlots: WorldOverviewOpenPlot[] = gameSessions
      .filter((session) => session.openPlots?.trim())
      .slice(0, 3)
      .map((session) => ({
        sessionId: session.id,
        sessionTitle: session.title,
        sessionNumber: session.sessionNumber,
        openPlots: session.openPlots!.trim(),
      }));

    const recentPages: WorldOverviewPage[] = [...pages]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 8);

    return {
      world: {
        id: world.id,
        name: world.name,
        slug: world.slug,
        description: world.description,
        guestModeEnabled: world.guestModeEnabled,
      },
      counts: {
        pages: pages.length,
        byCategory,
        published,
        drafts,
        campaigns: campaignCount,
        assets: assetCount,
        gameSessions: gameSessions.length,
      },
      portal: {
        portalEnabled: settings.portal.portalEnabled,
        publicSharingEnabled: settings.portal.publicSharingEnabled,
        visiblePageCount,
      },
      nextSession,
      openPlots,
      recentPages,
      playerNotesForReview: notesForReview,
    };
  }
}

export function createWorldOverviewService(db: PrismaClient): WorldOverviewService {
  return new WorldOverviewService(db);
}
