import type {
  DbCampaign as Campaign,
  DmPlayerNoteView,
  PrismaClient,
  SessionReviewDraft,
} from "@uwe/database/server";
import {
  buildSessionReviewDraft,
  createSessionLiveService,
  formatInGameDate,
  parseInGameDate,
  parseWorldCalendarMonths,
  toDmPlayerNoteView,
  type InGameDate,
  type WorldCalendarMonth,
} from "@uwe/database/server";
import { buildPageUrl } from "@uwe/database/page-types";

/*
 * Session-Abschluss („Kanonisierung"): nach dem Spielabend Ereignisse in die
 * Chronik, Quests abhaken, Weltuhr weiterstellen, geteilte Spielernotizen
 * reviewen. Bewusste Arbeitsteilung zur Session-Review (Live-Protokoll +
 * Recap-Text) — beide verlinken einander.
 *
 * Privatsphäre: in die Review-Liste kommen ausschließlich Notizen mit
 * status = visible_to_dm UND visibility != private. Der Status ist der
 * Freigabe-Schritt des Spielers; der Visibility-Filter ist der Doppelgurt.
 */

export interface WrapUpSessionRef {
  id: string;
  title: string;
  sessionNumber: number;
  date: Date | null;
  status: string;
  wrapped: boolean;
}

export interface WrapUpQuest {
  id: string;
  title: string;
  href: string;
}

export interface WrapUpEvent {
  id: string;
  title: string;
  summary: string;
  dateLabel: string;
}

export interface SessionWrapUp {
  campaign: Campaign;
  worldId: string;
  sessions: WrapUpSessionRef[];
  session: WrapUpSessionRef | null;
  reviewDraft: SessionReviewDraft | null;
  openQuests: WrapUpQuest[];
  factions: Array<{ id: string; title: string }>;
  sharedNotes: DmPlayerNoteView[];
  clock: { current: InGameDate | null; label: string | null; months: WorldCalendarMonth[] };
  sessionEvents: WrapUpEvent[];
}

export class SessionWrapUpService {
  constructor(private readonly db: PrismaClient) {}

  async getSessionWrapUp(
    worldSlug: string,
    campaignSlug: string,
    sessionId?: string | null,
  ): Promise<SessionWrapUp | null> {
    const campaign = await this.db.campaign.findFirst({
      where: { slug: campaignSlug, world: { slug: worldSlug } },
    });
    if (!campaign) return null;
    const { worldId } = campaign;

    const sessionRecords = await this.db.gameSession.findMany({
      where: { worldId, campaignId: campaign.id },
      select: { id: true, title: true, sessionNumber: true, date: true, status: true },
      orderBy: [{ sessionNumber: "desc" }],
    });
    const sessions: WrapUpSessionRef[] = sessionRecords.map((session) => ({
      ...session,
      wrapped: session.status === "summarized" || session.status === "archived",
    }));

    const session = sessionId
      ? sessions.find((candidate) => candidate.id === sessionId) ?? null
      : null;
    // Eine fremde Session-Id (andere Kampagne/Welt) fällt hier still heraus —
    // die Seite behandelt das wie „keine Session gewählt".

    const [calendar, factions] = await Promise.all([
      this.db.worldCalendar.findUnique({
        where: { worldId },
        select: { currentDate: true, months: true, name: true, epochLabel: true },
      }),
      this.db.factionState.findMany({
        where: { worldId, page: { campaignId: campaign.id } },
        include: { page: { select: { id: true, title: true } } },
        orderBy: [{ powerLevel: "desc" }],
      }),
    ]);
    const months = parseWorldCalendarMonths(calendar?.months);
    const current = calendar?.currentDate ? parseInGameDate(calendar.currentDate) : null;

    let reviewDraft: SessionReviewDraft | null = null;
    let sharedNotes: DmPlayerNoteView[] = [];
    let sessionEvents: WrapUpEvent[] = [];
    let openQuests: WrapUpQuest[] = [];

    if (session) {
      const [entries, notes, events, quests] = await Promise.all([
        createSessionLiveService(this.db).listEntries(session.id),
        this.db.playerNote.findMany({
          where: {
            worldId,
            gameSessionId: session.id,
            status: "visible_to_dm",
            visibility: { not: "private" },
          },
          include: {
            user: { select: { id: true, displayName: true } },
            page: { select: { id: true, title: true, slug: true } },
            gameSession: { select: { id: true, title: true, sessionNumber: true } },
            campaign: { select: { id: true, name: true, slug: true } },
          },
          orderBy: [{ createdAt: "asc" }],
        }),
        this.db.worldEvent.findMany({
          where: { worldId, gameSessionId: session.id },
          select: { id: true, title: true, summaryDm: true, summaryPlayer: true, inGameDate: true },
          orderBy: [{ createdAt: "asc" }],
        }),
        this.db.page.findMany({
          where: {
            worldId,
            campaignId: campaign.id,
            type: "quest",
            OR: [{ questStatus: null }, { questStatus: "open" }],
          },
          select: { id: true, title: true, slug: true, type: true },
          orderBy: { title: "asc" },
        }),
      ]);

      reviewDraft = buildSessionReviewDraft(entries);
      sharedNotes = notes.map(toDmPlayerNoteView);
      sessionEvents = events.map((event) => ({
        id: event.id,
        title: event.title,
        summary: event.summaryDm ?? event.summaryPlayer ?? "",
        dateLabel: formatInGameDate(parseInGameDate(event.inGameDate), months),
      }));
      openQuests = quests.map((quest) => ({
        id: quest.id,
        title: quest.title,
        href: buildPageUrl(worldSlug, quest.type, quest.slug),
      }));
    }

    return {
      campaign,
      worldId,
      sessions,
      session,
      reviewDraft,
      openQuests,
      factions: factions.map((faction) => ({ id: faction.page.id, title: faction.page.title })),
      sharedNotes,
      clock: {
        current,
        label: current ? formatInGameDate(current, months) : null,
        months,
      },
      sessionEvents,
    };
  }
}

export function createSessionWrapUpService(db: PrismaClient): SessionWrapUpService {
  return new SessionWrapUpService(db);
}
