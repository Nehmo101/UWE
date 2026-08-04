import type { DungeonPrepStatus } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { buildPageUrl } from "./page-types";

/**
 * Kampagnen-Radar: „Was passiert gerade in der Welt?" — eine read-only
 * Aggregation über Fraktionen, offene Quests, World Clock, letzte Session,
 * jüngste Ereignisse, NPC-Zustände, Dungeons und Kanon-Konflikte. Keine
 * Schreibvorgänge, alles aus vorhandenen Daten abgeleitet (Muster:
 * WorldInspectorService, aber eigene Datei — der Inspektor ist eingefroren).
 *
 * Wie im Dungeon-Cockpit ist die Kampagne ein optionaler Filter: ohne
 * `campaignId` zeigt der Radar die ganze Welt, mit ihr nur die Seiten dieser
 * Kampagne. Welt-Ereignisse und die Weltuhr bleiben ungefiltert — sie tragen
 * keine Kampagnen-Zuordnung, die Zeit der Welt ist für alle dieselbe.
 */

export interface RadarFaction {
  title: string;
  href: string;
  agenda: string;
  powerLevel: number | null;
}

export interface RadarQuest {
  id: string;
  title: string;
  href: string;
  slug: string;
  status: string;
}

export interface RadarEvent {
  id: string;
  title: string;
  summary: string;
  createdAt: Date;
}

export interface RadarLastSession {
  title: string;
  sessionNumber: number;
  date: Date | null;
  href: string;
}

export interface RadarDungeon {
  id: string;
  title: string;
  slug: string;
  href: string;
  summary: string | null;
  prepStatus: DungeonPrepStatus | null;
}

export interface CampaignRadarOptions {
  /** Nur Inhalte dieser Kampagne — dieselbe Semantik wie im Dungeon-Cockpit. */
  campaignId?: string | null;
}

export interface CampaignRadarData {
  worldSlug: string;
  clockLabel: string | null;
  factions: RadarFaction[];
  openQuests: RadarQuest[];
  recentEvents: RadarEvent[];
  lastSession: RadarLastSession | null;
  dungeons: RadarDungeon[];
  npcSummary: { total: number; flagged: number };
  canonConflicts: number;
}

/**
 * Formt ein World-Clock-Label aus dem (frei geformten) `currentDate`-Json.
 * Pure & defensiv: unbekannte Formen fallen auf Name/Epoche zurück.
 */
export function formatClockLabel(
  name: string | null | undefined,
  currentDate: unknown,
  epochLabel: string | null | undefined,
): string | null {
  const parts: string[] = [];
  if (currentDate && typeof currentDate === "object") {
    const record = currentDate as Record<string, unknown>;
    const day = record.day ?? record.d;
    const month = record.monthName ?? record.month ?? record.m;
    const year = record.year ?? record.y;
    const segment = [day, month, year].filter((v) => v != null && v !== "").join(". ");
    if (segment) parts.push(segment.trim());
  }
  if (epochLabel) parts.push(epochLabel);
  if (parts.length === 0) return name ? name : null;
  return name ? `${name}: ${parts.join(" ")}` : parts.join(" ");
}

export class CampaignRadarService {
  constructor(private readonly db: PrismaClient) {}

  async getRadar(
    worldSlug: string,
    options?: CampaignRadarOptions,
  ): Promise<CampaignRadarData | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;
    const worldId = world.id;
    const campaignFilter = options?.campaignId ? { campaignId: options.campaignId } : {};

    const [
      factions,
      openQuests,
      recentEvents,
      lastSession,
      dungeons,
      calendar,
      npcTotal,
      npcFlagged,
      canonConflicts,
    ] = await Promise.all([
      this.db.factionState.findMany({
        where: {
          worldId,
          ...(options?.campaignId ? { page: { campaignId: options.campaignId } } : {}),
        },
        orderBy: [{ powerLevel: "desc" }],
        include: { page: { select: { title: true, slug: true, type: true } } },
      }),
      this.db.page.findMany({
        where: {
          worldId,
          type: "quest",
          ...campaignFilter,
          OR: [{ questStatus: null }, { questStatus: "open" }],
        },
        select: { id: true, title: true, slug: true, type: true, questStatus: true },
        orderBy: { title: "asc" },
      }),
      this.db.worldEvent.findMany({
        where: { worldId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, title: true, summaryDm: true, summaryPlayer: true, createdAt: true },
      }),
      this.db.gameSession.findFirst({
        where: { worldId, status: { in: ["played", "summarized"] }, ...campaignFilter },
        orderBy: [{ sessionNumber: "desc" }],
        select: { title: true, sessionNumber: true, date: true },
      }),
      this.db.page.findMany({
        where: { worldId, type: "dungeon", ...campaignFilter },
        select: { id: true, title: true, slug: true, summary: true, prepStatus: true },
        orderBy: { title: "asc" },
      }),
      this.db.worldCalendar.findUnique({
        where: { worldId },
        select: { name: true, currentDate: true, epochLabel: true },
      }),
      this.db.page.count({ where: { worldId, type: "npc", ...campaignFilter } }),
      this.db.page.count({
        where: {
          worldId,
          type: "npc",
          ...campaignFilter,
          canonicalStatus: { in: ["contradictory", "deprecated"] },
        },
      }),
      this.db.page.count({
        where: { worldId, canonicalStatus: "contradictory", ...campaignFilter },
      }),
    ]);

    return {
      worldSlug,
      clockLabel: calendar
        ? formatClockLabel(calendar.name, calendar.currentDate, calendar.epochLabel)
        : null,
      factions: factions.map((faction) => ({
        title: faction.page.title,
        href: buildPageUrl(worldSlug, faction.page.type, faction.page.slug),
        agenda: faction.agenda,
        powerLevel: faction.powerLevel,
      })),
      openQuests: openQuests.map((quest) => ({
        id: quest.id,
        title: quest.title,
        href: buildPageUrl(worldSlug, quest.type, quest.slug),
        slug: quest.slug,
        status: quest.questStatus ?? "open",
      })),
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        title: event.title,
        summary: event.summaryDm ?? event.summaryPlayer ?? "",
        createdAt: event.createdAt,
      })),
      lastSession: lastSession
        ? {
            title: lastSession.title,
            sessionNumber: lastSession.sessionNumber,
            date: lastSession.date,
            href: `/worlds/${worldSlug}/sessions`,
          }
        : null,
      dungeons: dungeons.map((dungeon) => ({
        id: dungeon.id,
        title: dungeon.title,
        slug: dungeon.slug,
        href: `/worlds/${worldSlug}/dungeons/${dungeon.slug}`,
        summary: dungeon.summary,
        prepStatus: dungeon.prepStatus,
      })),
      npcSummary: { total: npcTotal, flagged: npcFlagged },
      canonConflicts,
    };
  }
}

export function createCampaignRadarService(db: PrismaClient): CampaignRadarService {
  return new CampaignRadarService(db);
}
