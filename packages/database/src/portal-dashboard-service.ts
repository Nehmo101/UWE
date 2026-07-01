import type { AccessContext } from "@uwe/auth";
import { filterPagesForViewer } from "@uwe/auth";
import type { PrismaClient } from "./client";
import type { PageType, QuestLifecycleStatus } from "./generated/prisma/client";
import type { PortalGameSessionView } from "./game-session";
import type { PortalPlayerNoteView } from "./player-note-service";
import { navCategoryForPageType } from "./page-types";
import { isOpenQuest } from "./quest-lifecycle-service";

/** Compact page card for the player portal dashboard. */
export interface PortalDashboardPage {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  summary: string | null;
  updatedAt: Date;
}

export interface PortalDashboardSession {
  id: string;
  title: string;
  sessionNumber: number;
  date: Date | null;
  summaryPlayer: string | null;
}

export interface PortalDashboardNote {
  id: string;
  content: string;
  status: PortalPlayerNoteView["status"];
  pageTitle: string | null;
  pageSlug: string | null;
  sessionTitle: string | null;
  sessionNumber: number | null;
  updatedAt: Date;
}

export interface PortalDashboardHandout {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  updatedAt: Date;
}

export interface PortalDashboardData {
  worldName: string;
  characterName: string | null;
  nextSession: PortalDashboardSession | null;
  lastRecap: PortalDashboardSession | null;
  openQuests: PortalDashboardPage[];
  knownNpcs: PortalDashboardPage[];
  knownPlaces: PortalDashboardPage[];
  characterPages: PortalDashboardPage[];
  newHandouts: PortalDashboardHandout[];
  myNotes: PortalDashboardNote[];
}

const NPC_TYPES: PageType[] = ["npc", "player_character", "monster"];
const PLACE_TYPES: PageType[] = [
  "location",
  "region",
  "dungeon",
  "dungeon_level",
  "room",
];
const HANDOUT_TYPES: PageType[] = ["handout", "item"];
const QUEST_TYPES: PageType[] = ["quest"];

function toDashboardPage(
  page: {
    id: string;
    title: string;
    slug: string;
    type: PageType;
    summary: string | null;
    updatedAt: Date;
  },
): PortalDashboardPage {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    type: page.type,
    summary: page.summary,
    updatedAt: page.updatedAt,
  };
}

function toDashboardNote(note: PortalPlayerNoteView): PortalDashboardNote {
  return {
    id: note.id,
    content: note.content,
    status: note.status,
    pageTitle: note.pageTitle,
    pageSlug: note.pageSlug,
    sessionTitle: note.sessionTitle,
    sessionNumber: note.sessionNumber,
    updatedAt: note.updatedAt,
  };
}

export class PortalDashboardService {
  constructor(private readonly db: PrismaClient) {}

  async buildDashboard(
    worldSlug: string,
    ctx: AccessContext,
    options: {
      visiblePages: Array<{
        id: string;
        title: string;
        slug: string;
        type: PageType;
        summary: string | null;
        updatedAt: Date;
        questStatus?: QuestLifecycleStatus | null;
      }>;
      publishedSessions: PortalGameSessionView[];
      playerNotes: PortalPlayerNoteView[];
    },
  ): Promise<PortalDashboardData | null> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, name: true },
    });
    if (!world) return null;

    const characterName =
      ctx.user && ctx.worldMembership?.role === "player"
        ? ctx.worldMembership.characterName
        : null;

    const openQuests = options.visiblePages
      .filter((page) => QUEST_TYPES.includes(page.type) && isOpenQuest(page.questStatus))
      .slice(0, 6)
      .map(toDashboardPage);

    const pages = options.visiblePages.map(toDashboardPage);

    const upcoming = options.publishedSessions
      .filter((session) => session.status === "planned" || session.status === "prepared")
      .sort((a, b) => a.sessionNumber - b.sessionNumber);

    const nextSession = upcoming[0]
      ? {
          id: upcoming[0].id,
          title: upcoming[0].title,
          sessionNumber: upcoming[0].sessionNumber,
          date: upcoming[0].date,
          summaryPlayer: upcoming[0].summaryPlayer,
        }
      : null;

    const played = options.publishedSessions
      .filter(
        (session) =>
          session.status === "played" ||
          session.status === "summarized" ||
          Boolean(session.summaryPlayer?.trim()),
      )
      .sort((a, b) => b.sessionNumber - a.sessionNumber);

    const lastRecap = played[0]
      ? {
          id: played[0].id,
          title: played[0].title,
          sessionNumber: played[0].sessionNumber,
          date: played[0].date,
          summaryPlayer: played[0].summaryPlayer,
        }
      : null;

    const knownNpcs = pages
      .filter((page) => NPC_TYPES.includes(page.type))
      .slice(0, 8);

    const knownPlaces = pages
      .filter((page) => PLACE_TYPES.includes(page.type))
      .slice(0, 8);

    const characterPages = pages
      .filter((page) => page.type === "player_character")
      .slice(0, 4);

    const handoutCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const newHandouts = pages
      .filter(
        (page) =>
          HANDOUT_TYPES.includes(page.type) &&
          page.updatedAt.getTime() >= handoutCutoff,
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 6)
      .map((page) => ({
        id: page.id,
        title: page.title,
        slug: page.slug,
        type: page.type,
        updatedAt: page.updatedAt,
      }));

    const myNotes = options.playerNotes
      .filter((note) => note.userId === ctx.user?.id)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 8)
      .map(toDashboardNote);

    return {
      worldName: world.name,
      characterName,
      nextSession,
      lastRecap,
      openQuests,
      knownNpcs,
      knownPlaces,
      characterPages,
      newHandouts,
      myNotes,
    };
  }

  /** Pages unlocked for the viewer since a session recap was published. */
  async listNewlyUnlockedPagesForSession(
    worldSlug: string,
    ctx: AccessContext,
    sessionNumber: number,
    sessionLabel: string,
  ): Promise<PortalDashboardPage[]> {
    if (!ctx.user) return [];

    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) return [];

    const unlocks = await this.db.sessionUnlock.findMany({
      where: {
        userId: ctx.user.id,
        OR: [
          { sessionLabel },
          { sessionLabel: `Session ${sessionNumber}` },
        ],
        page: { worldId: world.id },
      },
      include: {
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
            summary: true,
            updatedAt: true,
            visibility: true,
            publishStatus: true,
            secretLevel: true,
            revealState: true,
          },
        },
      },
      orderBy: { unlockedAt: "desc" },
    });

    const pages = unlocks.map((unlock) => unlock.page);
    return filterPagesForViewer(ctx, pages).map(toDashboardPage);
  }
}

export function createPortalDashboardService(db: PrismaClient): PortalDashboardService {
  return new PortalDashboardService(db);
}

/** Build a session label used when auto-unlocking content after recap publish. */
export function sessionUnlockLabel(sessionNumber: number, title: string): string {
  return `Session ${sessionNumber}: ${title}`;
}

export { navCategoryForPageType };
