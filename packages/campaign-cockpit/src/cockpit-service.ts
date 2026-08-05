import type {
  DbCampaign as Campaign,
  DungeonPrepStatus,
  PrismaClient,
  QuestLifecycleStatus,
  WikiPageNode,
} from "@uwe/database/server";
import {
  compareInGameDates,
  formatInGameDate,
  parseInGameDate,
  parseWorldCalendarMonths,
  renderPageContentHtml,
  suggestSlugFromTitle,
} from "@uwe/database/server";
import { buildPageUrl } from "@uwe/database/page-types";
import type { WorldWikiGraph } from "@uwe/database/page-service";
import { chapterProgress, compareChapterOrder } from "./chapter-helpers";
import {
  deriveQuestBacklinks,
  deriveQuestRelations,
  mergeQuestRelations,
  type QuestRelations,
} from "./quest-relations";

/*
 * Kampagnen-Cockpit — die Kampagne als Wurzel-Entität, exakte Analogie zum
 * Dungeon-Cockpit: Kampagne → Story-Bögen/Kapitel (story_arc) → Quests.
 * Kapitel nutzen prepStatus/sortIndex/campaignId, alles Bestandsfelder.
 * Feature-Package nach Modul-Disziplin: Domänen-Service außerhalb von
 * packages/database, PrismaClient kommt als Konstruktor-Argument.
 */

export const STORY_ARC_TYPE = "story_arc" as const;

// View-Typen wohnen in cockpit-types.ts (Datei-Budget); Re-Export hält alle
// Bestandsimporte über diesen Modulpfad gültig.
export type {
  CampaignCockpitSummary,
  CampaignOverview,
  ChapterQuest,
  ChapterSummary,
  ChapterView,
  CockpitDungeon,
  CockpitEvent,
  CockpitFaction,
  CockpitQuest,
  CockpitSessionRef,
} from "./cockpit-types";
import type {
  CampaignCockpitSummary,
  CampaignOverview,
  ChapterQuest,
  ChapterSummary,
  ChapterView,
  CockpitQuest,
  CockpitSessionRef,
} from "./cockpit-types";

const EVENT_ROLE_LABELS: Record<string, string> = {
  primary: "Hauptakteur",
  involved: "Beteiligt",
  location: "Ort",
  faction: "Fraktion",
  trigger: "Auslöser",
  consequence: "Folge",
};

function questStatus(value: string | null): QuestLifecycleStatus {
  return (value ?? "open") as QuestLifecycleStatus;
}

export class CampaignCockpitService {
  constructor(private readonly db: PrismaClient) {}

  async getCampaign(worldSlug: string, campaignSlug: string): Promise<Campaign | null> {
    return this.db.campaign.findFirst({
      where: { slug: campaignSlug, world: { slug: worldSlug } },
    });
  }

  /** Kompakte Cockpit-Kennzahlen je Kampagne für die Kampagnen-Liste. */
  async listCampaignSummaries(worldSlug: string): Promise<Map<string, CampaignCockpitSummary>> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return new Map();

    const [chapters, quests, sessions] = await Promise.all([
      this.db.page.findMany({
        where: { worldId: world.id, type: STORY_ARC_TYPE, campaignId: { not: null } },
        select: { campaignId: true, prepStatus: true },
      }),
      this.db.page.findMany({
        where: {
          worldId: world.id,
          type: "quest",
          campaignId: { not: null },
          OR: [{ questStatus: null }, { questStatus: "open" }],
        },
        select: { campaignId: true },
      }),
      this.db.gameSession.findMany({
        where: {
          worldId: world.id,
          campaignId: { not: null },
          status: { in: ["played", "summarized", "archived"] },
        },
        select: { campaignId: true, sessionNumber: true, title: true },
        orderBy: [{ sessionNumber: "desc" }],
      }),
    ]);

    const summaries = new Map<string, CampaignCockpitSummary>();
    const ensure = (campaignId: string): CampaignCockpitSummary => {
      let summary = summaries.get(campaignId);
      if (!summary) {
        summary = {
          campaignId,
          progress: chapterProgress([]),
          openQuests: 0,
          lastSession: null,
        };
        summaries.set(campaignId, summary);
      }
      return summary;
    };

    const chaptersByCampaign = new Map<string, Array<{ prepStatus: DungeonPrepStatus | null }>>();
    for (const chapter of chapters) {
      const list = chaptersByCampaign.get(chapter.campaignId as string) ?? [];
      list.push({ prepStatus: chapter.prepStatus });
      chaptersByCampaign.set(chapter.campaignId as string, list);
    }
    for (const [campaignId, list] of chaptersByCampaign) {
      ensure(campaignId).progress = chapterProgress(list);
    }
    for (const quest of quests) {
      ensure(quest.campaignId as string).openQuests += 1;
    }
    for (const session of sessions) {
      const summary = ensure(session.campaignId as string);
      if (!summary.lastSession) {
        summary.lastSession = { sessionNumber: session.sessionNumber, title: session.title };
      }
    }
    return summaries;
  }

  async getCampaignOverview(
    worldSlug: string,
    campaignSlug: string,
  ): Promise<CampaignOverview | null> {
    const campaign = await this.getCampaign(worldSlug, campaignSlug);
    if (!campaign) return null;
    const { worldId } = campaign;
    const base = `/worlds/${worldSlug}`;

    const [
      chapters,
      quests,
      factions,
      lastSession,
      nextSession,
      events,
      noteQueueCount,
      canonConflicts,
      calendar,
      dungeons,
      npcTotal,
      npcFlagged,
    ] = await Promise.all([
        this.db.page.findMany({
          where: { worldId, campaignId: campaign.id, type: STORY_ARC_TYPE },
          select: {
            id: true,
            title: true,
            slug: true,
            summary: true,
            prepStatus: true,
            sortIndex: true,
          },
        }),
        this.db.page.findMany({
          where: { worldId, campaignId: campaign.id, type: "quest" },
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
            questStatus: true,
            parentPageId: true,
          },
          orderBy: { title: "asc" },
        }),
        this.db.factionState.findMany({
          where: { worldId, page: { campaignId: campaign.id } },
          orderBy: [{ powerLevel: "desc" }],
          include: { page: { select: { id: true, title: true, slug: true, type: true } } },
        }),
        this.db.gameSession.findFirst({
          where: { worldId, campaignId: campaign.id, status: { in: ["played", "summarized", "archived"] } },
          orderBy: [{ sessionNumber: "desc" }],
          select: { id: true, title: true, sessionNumber: true, date: true, status: true },
        }),
        this.db.gameSession.findFirst({
          where: { worldId, campaignId: campaign.id, status: { in: ["planned", "prepared"] } },
          orderBy: [{ sessionNumber: "asc" }],
          select: { id: true, title: true, sessionNumber: true, date: true, status: true },
        }),
        this.db.worldEvent.findMany({
          where: {
            worldId,
            OR: [
              { gameSession: { campaignId: campaign.id } },
              { entityLinks: { some: { page: { campaignId: campaign.id } } } },
            ],
          },
          orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
          take: 40,
          select: {
            id: true,
            title: true,
            summaryDm: true,
            summaryPlayer: true,
            inGameDate: true,
            sortOrder: true,
          },
        }),
        this.db.playerNote.count({
          where: {
            worldId,
            campaignId: campaign.id,
            status: "visible_to_dm",
            visibility: { not: "private" },
          },
        }),
        this.db.page.count({
          where: { worldId, campaignId: campaign.id, canonicalStatus: "contradictory" },
        }),
        this.db.worldCalendar.findUnique({ where: { worldId }, select: { months: true } }),
        this.db.page.findMany({
          where: { worldId, campaignId: campaign.id, type: "dungeon" },
          select: { id: true, title: true, slug: true, summary: true, prepStatus: true },
          orderBy: { title: "asc" },
        }),
        this.db.page.count({ where: { worldId, campaignId: campaign.id, type: "npc" } }),
        this.db.page.count({
          where: {
            worldId,
            campaignId: campaign.id,
            type: "npc",
            canonicalStatus: { in: ["contradictory", "deprecated"] },
          },
        }),
      ]);

    const chapterIds = new Set(chapters.map((chapter) => chapter.id));
    const months = parseWorldCalendarMonths(calendar?.months);

    const countsByChapter = new Map<string, ChapterSummary["questCounts"]>();
    for (const chapter of chapters) {
      countsByChapter.set(chapter.id, { open: 0, completed: 0, failed: 0, total: 0 });
    }
    const unassignedQuests: CockpitQuest[] = [];
    for (const quest of quests) {
      const status = questStatus(quest.questStatus);
      const inChapter = quest.parentPageId && chapterIds.has(quest.parentPageId);
      if (inChapter) {
        const counts = countsByChapter.get(quest.parentPageId as string);
        if (counts) {
          counts.total += 1;
          counts[status] += 1;
        }
      } else {
        unassignedQuests.push({
          id: quest.id,
          title: quest.title,
          slug: quest.slug,
          href: buildPageUrl(worldSlug, quest.type, quest.slug),
          status,
          chapterId: null,
        });
      }
    }

    const orderedChapters = [...chapters].sort(compareChapterOrder).map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      slug: chapter.slug,
      summary: chapter.summary,
      prepStatus: chapter.prepStatus,
      sortIndex: chapter.sortIndex,
      href: `${base}/kampagnen/${campaign.slug}/kapitel/${chapter.slug}`,
      questCounts: countsByChapter.get(chapter.id) ?? {
        open: 0,
        completed: 0,
        failed: 0,
        total: 0,
      },
    }));

    const toSessionRef = (
      session: { id: string; title: string; sessionNumber: number; date: Date | null; status: string } | null,
    ): CockpitSessionRef | null =>
      session
        ? {
            id: session.id,
            title: session.title,
            sessionNumber: session.sessionNumber,
            date: session.date,
            status: session.status,
            href: `${base}/sessions/${session.id}`,
          }
        : null;

    return {
      campaign,
      worldId,
      chapters: orderedChapters,
      unassignedQuests,
      factions: factions.map((faction) => ({
        pageId: faction.page.id,
        title: faction.page.title,
        href: buildPageUrl(worldSlug, faction.page.type, faction.page.slug),
        agenda: faction.agenda,
        powerLevel: faction.powerLevel,
      })),
      lastSession: toSessionRef(lastSession),
      nextSession: toSessionRef(nextSession),
      recentEvents: events
        .map((event) => ({ ...event, parsedDate: parseInGameDate(event.inGameDate) }))
        .sort((a, b) => compareInGameDates(b.parsedDate, a.parsedDate) || b.sortOrder - a.sortOrder)
        .slice(0, 8)
        .map((event) => ({
          id: event.id,
          title: event.title,
          summary: event.summaryDm ?? event.summaryPlayer ?? "",
          inGameDate: event.parsedDate,
          dateLabel: formatInGameDate(event.parsedDate, months),
        })),
      noteQueueCount,
      canonConflicts,
      progress: chapterProgress(chapters),
      dungeons: dungeons.map((dungeon) => ({
        id: dungeon.id,
        title: dungeon.title,
        slug: dungeon.slug,
        href: `${base}/dungeons/${dungeon.slug}`,
        summary: dungeon.summary,
        prepStatus: dungeon.prepStatus,
      })),
      npcSummary: { total: npcTotal, flagged: npcFlagged },
    };
  }

  async getChapterView(
    worldSlug: string,
    campaignSlug: string,
    kapitelSlug: string,
    context: { wikiIndex: WikiPageNode[]; graph: WorldWikiGraph | null },
  ): Promise<ChapterView | null> {
    const campaign = await this.getCampaign(worldSlug, campaignSlug);
    if (!campaign) return null;

    const chapter = await this.db.page.findFirst({
      where: {
        worldId: campaign.worldId,
        campaignId: campaign.id,
        slug: kapitelSlug,
        type: STORY_ARC_TYPE,
      },
      include: { contentBlocks: { orderBy: { sortOrder: "asc" } }, campaign: true },
    });
    if (!chapter) return null;

    const [quests, campaignQuests, pinLinks, chapterDungeons, worldDungeons] = await Promise.all([
      this.db.page.findMany({
        where: { worldId: campaign.worldId, parentPageId: chapter.id, type: "quest" },
        include: { contentBlocks: { orderBy: { sortOrder: "asc" } }, campaign: true },
        orderBy: { title: "asc" },
      }),
      this.db.page.findMany({
        where: {
          worldId: campaign.worldId,
          campaignId: campaign.id,
          type: "quest",
          NOT: { parentPageId: chapter.id },
        },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      }),
      this.db.storyArcEntityLink.findMany({
        where: { storyArcPageId: chapter.id },
        include: { page: { select: { id: true, title: true, slug: true, type: true } } },
        orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
      }),
      this.db.page.findMany({
        where: { worldId: campaign.worldId, parentPageId: chapter.id, type: "dungeon" },
        select: { id: true, title: true, slug: true, summary: true, prepStatus: true },
        orderBy: { title: "asc" },
      }),
      this.db.page.findMany({
        where: {
          worldId: campaign.worldId,
          type: "dungeon",
          NOT: { parentPageId: chapter.id },
        },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      }),
    ]);

    const questIds = quests.map((quest) => quest.id);
    const eventLinks = questIds.length
      ? await this.db.worldEventEntityLink.findMany({
          where: { pageId: { in: questIds }, event: { worldId: campaign.worldId } },
          include: { event: { select: { id: true, title: true } } },
        })
      : [];
    const eventsByQuest = new Map<string, ChapterQuest["linkedEvents"]>();
    for (const link of eventLinks) {
      const list = eventsByQuest.get(link.pageId) ?? [];
      list.push({
        eventId: link.event.id,
        title: link.event.title,
        role: link.role,
        roleLabel: EVENT_ROLE_LABELS[link.role] ?? link.role,
      });
      eventsByQuest.set(link.pageId, list);
    }

    const emptyRelations: QuestRelations = { npcs: [], locations: [], factions: [] };

    const questViews = quests.map((quest) => ({
      id: quest.id,
      title: quest.title,
      slug: quest.slug,
      href: buildPageUrl(worldSlug, quest.type, quest.slug),
      status: questStatus(quest.questStatus),
      chapterId: chapter.id,
      relations: context.graph
        ? deriveQuestRelations(worldSlug, quest, context.graph)
        : emptyRelations,
      linkedEvents: eventsByQuest.get(quest.id) ?? [],
    }));

    // Kapiteltext + Quest-Texte: die abgeleiteten Beziehungen des ganzen Akts.
    const chapterRelations = context.graph
      ? deriveQuestRelations(worldSlug, chapter, context.graph)
      : emptyRelations;

    // Explizit gepinnte Seiten (Rolle wurde beim Pinnen aus dem Typ abgeleitet).
    const pins = pinLinks.map((link) => ({
      id: link.id,
      role: link.role as string,
      target: {
        id: link.page.id,
        title: link.page.title,
        slug: link.page.slug,
        type: link.page.type,
        href: buildPageUrl(worldSlug, link.page.type, link.page.slug),
      },
    }));
    const pinnedRelations: QuestRelations = { npcs: [], locations: [], factions: [] };
    for (const pin of pins) {
      if (pin.role === "npc") pinnedRelations.npcs.push(pin.target);
      else if (pin.role === "location") pinnedRelations.locations.push(pin.target);
      else if (pin.role === "faction") pinnedRelations.factions.push(pin.target);
      // handout-Pins erscheinen nur in der Pin-Liste, nicht in den drei Gruppen.
    }

    return {
      campaign,
      chapter: {
        id: chapter.id,
        title: chapter.title,
        slug: chapter.slug,
        summary: chapter.summary,
        prepStatus: chapter.prepStatus,
        sortIndex: chapter.sortIndex,
      },
      html: renderPageContentHtml(chapter, context.wikiIndex),
      quests: questViews,
      backlinks: context.graph
        ? deriveQuestBacklinks(worldSlug, chapter.id, context.graph)
        : [],
      assignableQuests: campaignQuests,
      actRelations: mergeQuestRelations(
        pinnedRelations,
        chapterRelations,
        ...questViews.map((q) => q.relations),
      ),
      pins,
      dungeons: chapterDungeons.map((dungeon) => ({
        id: dungeon.id,
        title: dungeon.title,
        slug: dungeon.slug,
        href: `/worlds/${worldSlug}/dungeons/${dungeon.slug}`,
        summary: dungeon.summary,
        prepStatus: dungeon.prepStatus,
      })),
      assignableDungeons: worldDungeons,
    };
  }

  async createChapter(input: {
    worldId: string;
    campaignId: string;
    title: string;
    summary?: string | null;
    content?: string;
  }): Promise<{ id: string; slug: string }> {
    const baseSlug = suggestSlugFromTitle(input.title);
    let slug = baseSlug;
    let suffix = 2;
    while (
      await this.db.page.findFirst({ where: { worldId: input.worldId, slug }, select: { id: true } })
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const maxSortIndex = await this.db.page.aggregate({
      where: { worldId: input.worldId, campaignId: input.campaignId, type: STORY_ARC_TYPE },
      _max: { sortIndex: true },
    });

    const chapter = await this.db.page.create({
      data: {
        worldId: input.worldId,
        campaignId: input.campaignId,
        title: input.title,
        slug,
        type: STORY_ARC_TYPE,
        summary: input.summary ?? null,
        prepStatus: "unprepared",
        sortIndex: (maxSortIndex._max.sortIndex ?? 0) + 1,
        contentBlocks: input.content
          ? { create: [{ type: "rich_text", sortOrder: 0, content: input.content }] }
          : undefined,
      },
      select: { id: true, slug: true },
    });
    return chapter;
  }

  async updateChapter(
    chapterId: string,
    input: { title?: string; summary?: string | null; prepStatus?: DungeonPrepStatus },
  ): Promise<void> {
    await this.db.page.update({
      where: { id: chapterId },
      data: {
        title: input.title,
        summary: input.summary,
        prepStatus: input.prepStatus,
      },
    });
  }

  /** Kapitel in der Lesereihenfolge einen Platz nach oben/unten tauschen. */
  async moveChapter(
    worldId: string,
    campaignId: string,
    chapterId: string,
    direction: "up" | "down",
  ): Promise<void> {
    const chapters = await this.db.page.findMany({
      where: { worldId, campaignId, type: STORY_ARC_TYPE },
      select: { id: true, title: true, sortIndex: true },
    });
    const ordered = chapters.sort(compareChapterOrder);
    const index = ordered.findIndex((chapter) => chapter.id === chapterId);
    if (index < 0) throw new Error("Kapitel nicht gefunden.");
    const neighborIndex = direction === "up" ? index - 1 : index + 1;
    if (neighborIndex < 0 || neighborIndex >= ordered.length) return;

    // Handgepflegte Kapitel (sortIndex null) bekommen beim ersten Verschieben
    // eine explizite Position — sonst gäbe es nichts zu tauschen.
    const normalized = ordered.map((chapter, position) => ({
      id: chapter.id,
      sortIndex: chapter.sortIndex ?? position + 1,
    }));
    const current = normalized[index];
    const neighbor = normalized[neighborIndex];
    const temp = current.sortIndex === neighbor.sortIndex ? neighbor.sortIndex + 1 : current.sortIndex;

    await this.db.$transaction([
      this.db.page.update({ where: { id: current.id }, data: { sortIndex: neighbor.sortIndex } }),
      this.db.page.update({ where: { id: neighbor.id }, data: { sortIndex: temp } }),
    ]);
  }

  /** Quest einem Kapitel zuordnen (oder mit null lösen). */
  async assignQuestToChapter(
    worldId: string,
    questId: string,
    chapterId: string | null,
  ): Promise<void> {
    const quest = await this.db.page.findFirst({
      where: { id: questId, worldId, type: "quest" },
      select: { id: true },
    });
    if (!quest) throw new Error("Quest nicht gefunden.");
    if (chapterId) {
      const chapter = await this.db.page.findFirst({
        where: { id: chapterId, worldId, type: STORY_ARC_TYPE },
        select: { id: true },
      });
      if (!chapter) throw new Error("Kapitel nicht gefunden.");
    }
    await this.db.page.update({
      where: { id: questId },
      data: { parentPageId: chapterId },
    });
  }

  /**
   * Dungeon einem Kapitel zuordnen (F6: eigenes Werkzeug, bessere Verbindung).
   * Dieselbe Kante wie bei Quests (`parentPageId`); beim Zuordnen wandert der
   * Dungeon zusätzlich in die Kampagne des Kapitels, damit Filter und
   * Kampagnen-Überblick ihn führen. Lösen (`chapterId: null`) lässt die
   * Kampagnen-Zuordnung stehen.
   */
  async assignDungeonToChapter(
    worldId: string,
    dungeonId: string,
    chapterId: string | null,
  ): Promise<void> {
    const dungeon = await this.db.page.findFirst({
      where: { id: dungeonId, worldId, type: "dungeon" },
      select: { id: true },
    });
    if (!dungeon) throw new Error("Dungeon nicht gefunden.");
    let campaignId: string | null | undefined;
    if (chapterId) {
      const chapter = await this.db.page.findFirst({
        where: { id: chapterId, worldId, type: STORY_ARC_TYPE },
        select: { id: true, campaignId: true },
      });
      if (!chapter) throw new Error("Kapitel nicht gefunden.");
      campaignId = chapter.campaignId;
    }
    await this.db.page.update({
      where: { id: dungeonId },
      data: {
        parentPageId: chapterId,
        ...(campaignId !== undefined ? { campaignId } : {}),
      },
    });
  }
}

export function createCampaignCockpitService(db: PrismaClient): CampaignCockpitService {
  return new CampaignCockpitService(db);
}
