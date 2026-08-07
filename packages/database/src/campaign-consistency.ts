import type { PrismaClient } from "./client";

export type CampaignConsistencyCode =
  | "quest_without_campaign"
  | "quest_without_story_arc"
  | "quest_story_arc_mismatch"
  | "dungeon_without_domain"
  | "dungeon_domain_mismatch"
  | "orphan_dungeon_level"
  | "session_focus_mismatch"
  | "multiple_current_focuses"
  | "duplicate_title"
  | "dead_wikilink";

export interface CampaignConsistencyFinding {
  code: CampaignConsistencyCode;
  worldId: string;
  campaignId: string | null;
  entityId: string;
  message: string;
}

const normalize = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase("de");
const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};

/** Dekodiert jede Entity genau einmal; neu entstehende Zeichen werden nicht erneut verarbeitet. */
const decodeHtml = (value: string) => value.replace(
  /&(?:#x[0-9a-f]+|#\d+|amp|apos|gt|lt|quot);/gi,
  (entity) => {
    const body = entity.slice(1, -1).toLocaleLowerCase("en");
    if (body.startsWith("#x")) return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return NAMED_HTML_ENTITIES[body] ?? entity;
  },
);

/** Fachliche Konsistenzprüfung; der Seitenbaum ist ausdrücklich nicht die Zuordnungsquelle. */
export async function checkCampaignConsistency(
  db: PrismaClient,
  options: { worldId?: string; campaignId?: string } = {},
): Promise<CampaignConsistencyFinding[]> {
  const pageWhere = {
    ...(options.worldId ? { worldId: options.worldId } : {}),
    ...(options.campaignId ? { campaignId: options.campaignId } : {}),
  };
  const [pages, referencePages, dungeons, sessions] = await Promise.all([
    db.page.findMany({
      where: pageWhere,
      select: {
        id: true, worldId: true, campaignId: true, parentPageId: true,
        questStoryArcId: true, title: true, slug: true, aliases: true, type: true,
        contentBlocks: { select: { content: true } },
      },
    }),
    db.page.findMany({
      where: options.worldId ? { worldId: options.worldId } : {},
      select: { worldId: true, title: true, slug: true, aliases: true },
    }),
    db.dungeon.findMany({
      where: {
        ...(options.worldId ? { worldId: options.worldId } : {}),
        ...(options.campaignId ? { campaignId: options.campaignId } : {}),
      },
      select: { id: true, worldId: true, campaignId: true, rootPageId: true, storyArcPageId: true },
    }),
    db.gameSession.findMany({
      where: {
        ...(options.worldId ? { worldId: options.worldId } : {}),
        ...(options.campaignId ? { campaignId: options.campaignId } : {}),
      },
      select: {
        id: true, worldId: true, campaignId: true,
        focuses: { select: { id: true, role: true, isCurrent: true, page: { select: { worldId: true, type: true } } } },
      },
    }),
  ]);

  const findings: CampaignConsistencyFinding[] = [];
  const byId = new Map(pages.map((page) => [page.id, page]));
  const dungeonByRoot = new Map(dungeons.map((dungeon) => [dungeon.rootPageId, dungeon]));
  const add = (finding: CampaignConsistencyFinding) => findings.push(finding);

  for (const page of pages) {
    if (page.type === "quest") {
      if (!page.campaignId) add({ code: "quest_without_campaign", worldId: page.worldId, campaignId: null, entityId: page.id, message: `Quest „${page.title}“ hat keine Kampagne.` });
      if (!page.questStoryArcId) add({ code: "quest_without_story_arc", worldId: page.worldId, campaignId: page.campaignId, entityId: page.id, message: `Quest „${page.title}“ hat keinen Story-Bogen.` });
      else {
        const arc = byId.get(page.questStoryArcId);
        if (!arc || arc.type !== "story_arc" || arc.worldId !== page.worldId || arc.campaignId !== page.campaignId) {
          add({ code: "quest_story_arc_mismatch", worldId: page.worldId, campaignId: page.campaignId, entityId: page.id, message: `Quest „${page.title}“ verweist auf einen fremden oder ungültigen Story-Bogen.` });
        }
      }
    }
    if (page.type === "dungeon" && !dungeonByRoot.has(page.id)) {
      add({ code: "dungeon_without_domain", worldId: page.worldId, campaignId: page.campaignId, entityId: page.id, message: `Dungeon „${page.title}“ besitzt keinen Dungeon-Datensatz.` });
    }
    if (page.type === "dungeon_level") {
      const parent = page.parentPageId ? byId.get(page.parentPageId) : null;
      if (!parent || parent.type !== "dungeon") add({ code: "orphan_dungeon_level", worldId: page.worldId, campaignId: page.campaignId, entityId: page.id, message: `Dungeon-Ebene „${page.title}“ hängt nicht unter einer Dungeon-Wurzel.` });
    }
  }

  for (const dungeon of dungeons) {
    const root = byId.get(dungeon.rootPageId);
    const arc = dungeon.storyArcPageId ? byId.get(dungeon.storyArcPageId) : null;
    if (!root || root.type !== "dungeon" || root.worldId !== dungeon.worldId || root.campaignId !== dungeon.campaignId || (arc && (arc.type !== "story_arc" || arc.campaignId !== dungeon.campaignId))) {
      add({ code: "dungeon_domain_mismatch", worldId: dungeon.worldId, campaignId: dungeon.campaignId, entityId: dungeon.id, message: `Dungeon-Datensatz ${dungeon.id} passt nicht zu Wurzel, Kampagne oder Story-Bogen.` });
    }
  }

  const expectedTypes: Record<string, string[]> = { chapter: ["story_arc"], dungeon: ["dungeon"], room: ["room", "dungeon_level"], quest: ["quest"], reference: [] };
  for (const session of sessions) {
    if (session.focuses.filter((focus) => focus.isCurrent).length > 1) add({ code: "multiple_current_focuses", worldId: session.worldId, campaignId: session.campaignId, entityId: session.id, message: `Session ${session.id} hat mehr als einen aktuellen Fokus.` });
    for (const focus of session.focuses) {
      const allowed = expectedTypes[focus.role] ?? [];
      if (focus.page.worldId !== session.worldId || (allowed.length > 0 && !allowed.includes(focus.page.type))) add({ code: "session_focus_mismatch", worldId: session.worldId, campaignId: session.campaignId, entityId: focus.id, message: `Session-Fokus ${focus.id} hat Welt oder Seitentyp ${focus.page.type} falsch zugeordnet.` });
    }
  }

  const titles = new Map<string, typeof pages>();
  for (const page of pages.filter((entry) => entry.campaignId)) {
    const key = `${page.campaignId}:${normalize(page.title)}`;
    titles.set(key, [...(titles.get(key) ?? []), page]);
  }
  for (const group of titles.values()) if (group.length > 1) for (const page of group) add({ code: "duplicate_title", worldId: page.worldId, campaignId: page.campaignId, entityId: page.id, message: `Titel „${page.title}“ ist in derselben Kampagne mehrfach vorhanden.` });

  const knownByWorld = new Map<string, Set<string>>();
  for (const page of referencePages) {
    const known = knownByWorld.get(page.worldId) ?? new Set<string>();
    known.add(normalize(page.title)); known.add(normalize(page.slug));
    if (Array.isArray(page.aliases)) for (const alias of page.aliases) if (typeof alias === "string") known.add(normalize(alias));
    knownByWorld.set(page.worldId, known);
  }
  const deadSeen = new Set<string>();
  for (const page of pages) for (const block of page.contentBlocks) for (const match of block.content.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = decodeHtml((match[1] ?? "").split("|")[0]).split("#")[0].trim();
    const key = `${page.id}:${normalize(target)}`;
    if (target && !deadSeen.has(key) && !knownByWorld.get(page.worldId)?.has(normalize(target))) {
      deadSeen.add(key);
      add({ code: "dead_wikilink", worldId: page.worldId, campaignId: page.campaignId, entityId: page.id, message: `„${page.title}“ verweist auf fehlendes Ziel „${target}“.` });
    }
  }
  return findings.sort((a, b) => a.code.localeCompare(b.code) || a.message.localeCompare(b.message, "de"));
}
