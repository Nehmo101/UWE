import type {
  DbCampaign as Campaign,
  PrismaClient,
  QuestLifecycleStatus,
  WikiPageNode,
} from "@uwe/database/server";
import { renderPageContentHtml } from "@uwe/database/server";
import { buildPageUrl } from "@uwe/database/page-types";
import type { WorldWikiGraph } from "@uwe/database/page-service";
import { compareChapterOrder } from "./chapter-helpers";
import {
  descendantChapterIds,
  rollupChapterQuestCounts,
  type ChapterQuestCounts,
} from "./chapter-hierarchy";
import type { ChapterQuest, ChapterSummary, ChapterView } from "./cockpit-types";
import {
  deriveQuestBacklinks,
  deriveQuestRelations,
  mergeQuestRelations,
  type QuestRelations,
} from "./quest-relations";

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

function emptyCounts(): ChapterQuestCounts {
  return { open: 0, completed: 0, failed: 0, total: 0 };
}

export async function getCampaignChapterView(
  db: PrismaClient,
  campaign: Campaign,
  worldSlug: string,
  kapitelSlug: string,
  context: { wikiIndex: WikiPageNode[]; graph: WorldWikiGraph | null },
): Promise<ChapterView | null> {
  const campaignChapters = await db.page.findMany({
    where: { worldId: campaign.worldId, campaignId: campaign.id, type: "story_arc" },
    include: { contentBlocks: { orderBy: { sortOrder: "asc" } }, campaign: true },
  });
  const chapter = campaignChapters.find((candidate) => candidate.slug === kapitelSlug);
  if (!chapter) return null;

  const chapterIds = new Set(campaignChapters.map((candidate) => candidate.id));
  const hierarchy = campaignChapters.map((candidate) => ({
    ...candidate,
    parentChapterId: chapterIds.has(candidate.parentPageId ?? "")
      ? candidate.parentPageId
      : null,
  }));
  const scopeIds = descendantChapterIds(hierarchy, chapter.id);
  const scopeIdSet = new Set(scopeIds);
  const scopedChapters = hierarchy.filter((candidate) => scopeIdSet.has(candidate.id));
  const questScope = {
    OR: [
      { questStoryArcId: { in: scopeIds } },
      { questStoryArcId: null, parentPageId: { in: scopeIds } },
    ],
  };

  const [quests, campaignQuests, pinLinks, chapterDungeons, worldDungeons] = await Promise.all([
    db.page.findMany({
      where: { worldId: campaign.worldId, type: "quest", ...questScope },
      include: { contentBlocks: { orderBy: { sortOrder: "asc" } }, campaign: true },
      orderBy: { title: "asc" },
    }),
    db.page.findMany({
      where: { worldId: campaign.worldId, campaignId: campaign.id, type: "quest", NOT: questScope },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    db.storyArcEntityLink.findMany({
      where: { storyArcPageId: { in: scopeIds } },
      include: { page: { select: { id: true, title: true, slug: true, type: true } } },
      orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
    }),
    db.page.findMany({
      where: { worldId: campaign.worldId, parentPageId: { in: scopeIds }, type: "dungeon" },
      select: { id: true, title: true, slug: true, summary: true, prepStatus: true },
      orderBy: { title: "asc" },
    }),
    db.page.findMany({
      where: { worldId: campaign.worldId, type: "dungeon", NOT: { parentPageId: { in: scopeIds } } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const eventLinks = quests.length
    ? await db.worldEventEntityLink.findMany({
        where: { pageId: { in: quests.map((quest) => quest.id) }, event: { worldId: campaign.worldId } },
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
  const directCounts = new Map<string, ChapterQuestCounts>();
  for (const candidate of scopedChapters) directCounts.set(candidate.id, emptyCounts());
  const questViews = quests.map((quest) => {
    const assignedChapterId = quest.questStoryArcId ?? quest.parentPageId;
    const counts = assignedChapterId ? directCounts.get(assignedChapterId) : undefined;
    const status = questStatus(quest.questStatus);
    if (counts) {
      counts.total += 1;
      counts[status] += 1;
    }
    return {
      id: quest.id,
      title: quest.title,
      slug: quest.slug,
      href: buildPageUrl(worldSlug, quest.type, quest.slug),
      status,
      chapterId: assignedChapterId,
      relations: context.graph ? deriveQuestRelations(worldSlug, quest, context.graph) : emptyRelations,
      linkedEvents: eventsByQuest.get(quest.id) ?? [],
    };
  });
  const rolledCounts = rollupChapterQuestCounts(scopedChapters, directCounts);

  const subchapters: ChapterSummary[] = scopedChapters
    .filter((candidate) => candidate.id !== chapter.id)
    .sort(compareChapterOrder)
    .map((candidate) => ({
      id: candidate.id,
      parentChapterId: candidate.parentChapterId,
      title: candidate.title,
      slug: candidate.slug,
      summary: candidate.summary,
      prepStatus: candidate.prepStatus,
      sortIndex: candidate.sortIndex,
      href: `/worlds/${worldSlug}/kampagnen/${campaign.slug}/kapitel/${candidate.slug}`,
      questCounts: rolledCounts.get(candidate.id) ?? emptyCounts(),
    }));

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
  }
  const chapterRelations = scopedChapters.map((candidate) =>
    context.graph ? deriveQuestRelations(worldSlug, candidate, context.graph) : emptyRelations,
  );

  return {
    campaign,
    chapter: {
      id: chapter.id,
      parentChapterId: hierarchy.find((candidate) => candidate.id === chapter.id)?.parentChapterId ?? null,
      title: chapter.title,
      slug: chapter.slug,
      summary: chapter.summary,
      prepStatus: chapter.prepStatus,
      sortIndex: chapter.sortIndex,
    },
    html: renderPageContentHtml(chapter, context.wikiIndex),
    subchapters,
    quests: questViews,
    backlinks: context.graph ? deriveQuestBacklinks(worldSlug, chapter.id, context.graph) : [],
    assignableQuests: campaignQuests,
    actRelations: mergeQuestRelations(
      pinnedRelations,
      ...chapterRelations,
      ...questViews.map((quest) => quest.relations),
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
