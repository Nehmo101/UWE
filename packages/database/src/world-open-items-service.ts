import type { PrismaClient } from "./client";
import type { CanonicalStatus, PageType, PublishStatus } from "./generated/prisma/client";
import { buildPageUrl } from "./page-types";
import { isOpenQuest } from "./quest-lifecycle-service";

export type WorldOpenItemCategory =
  | "open_quest"
  | "session_plot"
  | "draft_npc"
  | "open_puzzle"
  | "prepared_content";

export interface WorldOpenItem {
  id: string;
  category: WorldOpenItemCategory;
  title: string;
  summary: string | null;
  href: string;
  meta: string;
  updatedAt: Date | null;
}

export const WORLD_OPEN_ITEM_CATEGORY_LABELS: Record<WorldOpenItemCategory, string> = {
  open_quest: "Offene Quests",
  session_plot: "Session-Plots",
  draft_npc: "NPCs in Arbeit",
  open_puzzle: "Offene Rätsel",
  prepared_content: "Vorbereitet, noch nicht gespielt",
};

const STALE_DAYS = 30;

export class WorldOpenItemsService {
  constructor(private readonly db: PrismaClient) {}

  async listForWorld(worldSlug: string): Promise<WorldOpenItem[]> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, slug: true },
    });
    if (!world) {
      return [];
    }

    const staleCutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
    const [pages, sessions] = await Promise.all([
      this.db.page.findMany({
        where: { worldId: world.id },
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          summary: true,
          questStatus: true,
          publishStatus: true,
          canonicalStatus: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: "desc" }],
      }),
      this.db.gameSession.findMany({
        where: { worldId: world.id },
        select: {
          id: true,
          title: true,
          sessionNumber: true,
          openPlots: true,
          updatedAt: true,
        },
        orderBy: [{ sessionNumber: "desc" }],
      }),
    ]);

    const items: WorldOpenItem[] = [];

    for (const page of pages) {
      if (page.type === "quest" && isOpenQuest(page.questStatus)) {
        items.push({
          id: `quest-${page.id}`,
          category: "open_quest",
          title: page.title,
          summary: page.summary,
          href: buildPageUrl(world.slug, page.type as PageType, page.slug),
          meta: "Offen",
          updatedAt: page.updatedAt,
        });
      }

      if (
        page.type === "npc" &&
        (page.publishStatus === "draft" || page.canonicalStatus === "draft")
      ) {
        items.push({
          id: `npc-${page.id}`,
          category: "draft_npc",
          title: page.title,
          summary: page.summary,
          href: buildPageUrl(world.slug, page.type as PageType, page.slug),
          meta: `${labelPublish(page.publishStatus)} · ${labelCanon(page.canonicalStatus)}`,
          updatedAt: page.updatedAt,
        });
      }

      if (page.type === "puzzle" && page.publishStatus === "draft") {
        items.push({
          id: `puzzle-${page.id}`,
          category: "open_puzzle",
          title: page.title,
          summary: page.summary,
          href: buildPageUrl(world.slug, page.type as PageType, page.slug),
          meta: "Entwurf",
          updatedAt: page.updatedAt,
        });
      }

      if (page.canonicalStatus === "prepared") {
        items.push({
          id: `prepared-${page.id}`,
          category: "prepared_content",
          title: page.title,
          summary: page.summary,
          href: buildPageUrl(world.slug, page.type as PageType, page.slug),
          meta: `Typ: ${page.type}`,
          updatedAt: page.updatedAt,
        });
      }

      if (
        page.type === "npc" &&
        page.updatedAt.getTime() < staleCutoff &&
        page.publishStatus !== "published"
      ) {
        const exists = items.some((item) => item.id === `npc-${page.id}`);
        if (!exists) {
          items.push({
            id: `stale-npc-${page.id}`,
            category: "draft_npc",
            title: page.title,
            summary: page.summary,
            href: buildPageUrl(world.slug, page.type as PageType, page.slug),
            meta: `Seit ${STALE_DAYS}+ Tagen unverändert`,
            updatedAt: page.updatedAt,
          });
        }
      }
    }

    for (const session of sessions) {
      const text = session.openPlots?.trim();
      if (!text) {
        continue;
      }

      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      lines.forEach((line, index) => {
        items.push({
          id: `plot-${session.id}-${index}`,
          category: "session_plot",
          title: line.length > 80 ? `${line.slice(0, 77)}…` : line,
          summary: line,
          href: `/worlds/${world.slug}/sessions/${session.id}`,
          meta: `Session ${session.sessionNumber}: ${session.title}`,
          updatedAt: session.updatedAt,
        });
      });
    }

    return items.sort((a, b) => {
      const aTime = a.updatedAt?.getTime() ?? 0;
      const bTime = b.updatedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  }
}

function labelPublish(status: PublishStatus): string {
  return status === "published" ? "Veröffentlicht" : "Entwurf";
}

function labelCanon(status: CanonicalStatus): string {
  switch (status) {
    case "draft":
      return "Kanon: Entwurf";
    case "prepared":
      return "Kanon: Vorbereitet";
    case "played":
      return "Kanon: Gespielt";
    case "canon":
      return "Kanon: Canon";
    case "discarded":
      return "Kanon: Verworfen";
    default:
      return `Kanon: ${status}`;
  }
}

export function createWorldOpenItemsService(db: PrismaClient): WorldOpenItemsService {
  return new WorldOpenItemsService(db);
}

export function groupOpenItemsByCategory(
  items: WorldOpenItem[],
): Record<WorldOpenItemCategory, WorldOpenItem[]> {
  return {
    open_quest: items.filter((item) => item.category === "open_quest"),
    session_plot: items.filter((item) => item.category === "session_plot"),
    draft_npc: items.filter((item) => item.category === "draft_npc"),
    open_puzzle: items.filter((item) => item.category === "open_puzzle"),
    prepared_content: items.filter((item) => item.category === "prepared_content"),
  };
}
