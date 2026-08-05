import type { PrismaClient } from "@uwe/database/server";
import type { PageType, StoryArcEntityRole } from "@uwe/database/enums";
import { buildPageUrl } from "@uwe/database/page-types";
import type { QuestRelationTarget } from "./quest-relations";
import { STORY_ARC_TYPE } from "./cockpit-service";

/*
 * Akt-Tafel-Pinnen: explizite Kante Kapitel ↔ Seite (StoryArcEntityLink).
 * Ergänzt die aus [[Wiki-Links]] abgeleiteten Beziehungen um Seiten, die im
 * Text (noch) nicht verlinkt sind — der DM heftet den Bösewicht an den Akt,
 * bevor die Quest geschrieben ist. Lesen und Mergen übernimmt getChapterView;
 * hier wohnen die Mutationen samt Welt- und Typ-Guards.
 */

export interface StoryArcPin {
  id: string;
  role: StoryArcEntityRole;
  target: QuestRelationTarget;
}

/** Welche Seitentypen sich pinnen lassen — Rolle wird aus dem Typ abgeleitet. */
const ROLE_BY_PAGE_TYPE: Partial<Record<PageType, StoryArcEntityRole>> = {
  npc: "npc",
  player_character: "npc",
  monster: "npc",
  location: "location",
  region: "location",
  faction: "faction",
  handout: "handout",
};

export function pinRoleForPageType(type: PageType): StoryArcEntityRole | null {
  return ROLE_BY_PAGE_TYPE[type] ?? null;
}

export class StoryArcPinService {
  constructor(private readonly db: PrismaClient) {}

  /** Pinnt eine Seite ans Kapitel. Beide Seiten müssen zur selben Welt gehören. */
  async pin(worldId: string, storyArcPageId: string, pageId: string): Promise<StoryArcPin> {
    const [chapter, target] = await Promise.all([
      this.db.page.findFirst({
        where: { id: storyArcPageId, worldId, type: STORY_ARC_TYPE },
        select: { id: true, world: { select: { slug: true } } },
      }),
      this.db.page.findFirst({
        where: { id: pageId, worldId },
        select: { id: true, title: true, slug: true, type: true },
      }),
    ]);
    if (!chapter || !target) {
      throw new Error("Kapitel oder Seite nicht gefunden.");
    }
    const role = pinRoleForPageType(target.type);
    if (!role) {
      throw new Error("Dieser Seitentyp lässt sich nicht an ein Kapitel pinnen.");
    }

    const link = await this.db.storyArcEntityLink.upsert({
      where: { storyArcPageId_pageId_role: { storyArcPageId, pageId, role } },
      create: { storyArcPageId, pageId, role },
      update: {},
    });

    return {
      id: link.id,
      role,
      target: {
        id: target.id,
        title: target.title,
        slug: target.slug,
        type: target.type,
        href: buildPageUrl(chapter.world.slug, target.type, target.slug),
      },
    };
  }

  /** Entfernt einen Pin — Welt-Guard über das Kapitel des Links. */
  async unpin(worldId: string, linkId: string): Promise<void> {
    await this.db.storyArcEntityLink.deleteMany({
      where: { id: linkId, storyArcPage: { worldId } },
    });
  }
}

export function createStoryArcPinService(db: PrismaClient): StoryArcPinService {
  return new StoryArcPinService(db);
}
