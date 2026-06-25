import type {
  CalendarEventKind,
  CalendarFeedDirection,
  CalendarFeedType,
  Prisma,
} from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";
import { decryptSecret, encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";

export type {
  CalendarEvent,
  CalendarFeed,
  CalendarEventKind,
  CalendarFeedType,
  CalendarFeedDirection,
} from "./generated/prisma/client";

export {
  CalendarEventKind as CalendarEventKindEnum,
  CalendarFeedType as CalendarFeedTypeEnum,
  CalendarFeedDirection as CalendarFeedDirectionEnum,
} from "./generated/prisma/client";

export const CALENDAR_EVENT_KIND_LABELS: Record<CalendarEventKind, string> = {
  session: "Spielsession",
  prep: "Vorbereitung",
  personal: "Persönlich",
  external: "Extern",
  dnd: "DnD",
};

export const CALENDAR_FEED_TYPE_LABELS: Record<CalendarFeedType, string> = {
  local: "Lokal (UWE)",
  caldav: "CalDAV",
  ical_url: "iCal-Abonnement",
  familywall: "FamilyWall (read-only)",
};

export interface CreateCalendarFeedInput {
  name: string;
  type: CalendarFeedType;
  direction?: CalendarFeedDirection;
  url?: string | null;
  caldavUrl?: string | null;
  username?: string | null;
  password?: string | null;
  enabled?: boolean;
  color?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateCalendarEventInput {
  feedId?: string | null;
  worldId?: string | null;
  sessionId?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: Date;
  endAt?: Date | null;
  allDay?: boolean;
  kind?: CalendarEventKind;
  externalUid?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListCalendarEventsOptions {
  from?: Date;
  to?: Date;
  worldId?: string;
  feedId?: string;
  kind?: CalendarEventKind;
  limit?: number;
}

export interface ListCalendarEventsForAggregationOptions {
  from?: Date;
  to?: Date;
  /** When set, include feed/personal events (no world) plus events for this world. */
  worldId?: string;
  limit?: number;
}

export class CalendarService {
  constructor(
    private readonly db: PrismaClient,
    private readonly encryptionSecret: string = resolveTokenEncryptionSecret(),
  ) {}

  async listFeeds(includeDisabled = false) {
    return this.db.calendarFeed.findMany({
      where: includeDisabled ? undefined : { enabled: true },
      orderBy: { name: "asc" },
    });
  }

  async getFeed(id: string) {
    return this.db.calendarFeed.findUnique({ where: { id } });
  }

  async createFeed(input: CreateCalendarFeedInput) {
    const password = input.password?.trim();
    return this.db.calendarFeed.create({
      data: {
        name: input.name.trim(),
        type: input.type,
        direction: input.direction ?? "read_only",
        url: input.url?.trim() || null,
        caldavUrl: input.caldavUrl?.trim() || null,
        username: input.username?.trim() || null,
        credentialsEnc: password
          ? encryptSecret(password, this.encryptionSecret)
          : null,
        enabled: input.enabled ?? true,
        color: input.color?.trim() || null,
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async updateFeed(id: string, input: Partial<CreateCalendarFeedInput>) {
    return this.db.calendarFeed.update({
      where: { id },
      data: {
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.type != null ? { type: input.type } : {}),
        ...(input.direction != null ? { direction: input.direction } : {}),
        ...(input.url !== undefined ? { url: input.url?.trim() || null } : {}),
        ...(input.caldavUrl !== undefined ? { caldavUrl: input.caldavUrl?.trim() || null } : {}),
        ...(input.username !== undefined ? { username: input.username?.trim() || null } : {}),
        ...(input.password !== undefined
          ? {
              credentialsEnc: input.password?.trim()
                ? encryptSecret(input.password.trim(), this.encryptionSecret)
                : null,
            }
          : {}),
        ...(input.enabled != null ? { enabled: input.enabled } : {}),
        ...(input.color !== undefined ? { color: input.color?.trim() || null } : {}),
        ...(input.metadata !== undefined ? { metadata: toPrismaJsonValue(input.metadata) } : {}),
      },
    });
  }

  async deleteFeed(id: string) {
    await this.db.calendarFeed.delete({ where: { id } });
  }

  async listEvents(options: ListCalendarEventsOptions = {}) {
    const where: Prisma.CalendarEventWhereInput = {};
    if (options.worldId) where.worldId = options.worldId;
    if (options.feedId) where.feedId = options.feedId;
    if (options.kind) where.kind = options.kind;
    if (options.from || options.to) {
      where.startAt = {};
      if (options.from) where.startAt.gte = options.from;
      if (options.to) where.startAt.lte = options.to;
    }
    return this.db.calendarEvent.findMany({
      where,
      orderBy: { startAt: "asc" },
      take: options.limit ?? 500,
      include: { feed: true, session: true },
    });
  }

  /**
   * Read-only event list for /today and other cross-module aggregations.
   * Keeps external feed events (worldId null) while optionally scoping DnD events to one world.
   */
  async listEventsForAggregation(options: ListCalendarEventsForAggregationOptions = {}) {
    const where: Prisma.CalendarEventWhereInput = {
      AND: [
        {
          OR: [{ feedId: null }, { feed: { enabled: true } }],
        },
        ...(options.worldId
          ? [{ OR: [{ worldId: null }, { worldId: options.worldId }] }]
          : []),
      ],
    };

    if (options.from || options.to) {
      where.startAt = {};
      if (options.from) where.startAt.gte = options.from;
      if (options.to) where.startAt.lte = options.to;
    }

    return this.db.calendarEvent.findMany({
      where,
      orderBy: { startAt: "asc" },
      take: options.limit ?? 500,
      include: { feed: true, session: true },
    });
  }

  async createEvent(input: CreateCalendarEventInput) {
    const feed = input.feedId
      ? await this.db.calendarFeed.findUnique({ where: { id: input.feedId } })
      : null;

    return this.db.calendarEvent.create({
      data: {
        feedId: input.feedId ?? null,
        worldId: input.worldId ?? null,
        sessionId: input.sessionId ?? null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        location: input.location?.trim() || null,
        startAt: input.startAt,
        endAt: input.endAt ?? null,
        allDay: input.allDay ?? false,
        kind: input.kind ?? "personal",
        externalUid: input.externalUid ?? null,
        metadata: toPrismaJsonValue(input.metadata),
        caldavPending: feed?.type === "caldav" && feed.direction !== "read_only",
      },
    });
  }

  async updateEvent(id: string, input: Partial<CreateCalendarEventInput>) {
    const existing = await this.db.calendarEvent.findUnique({
      where: { id },
      include: { feed: true },
    });
    if (!existing) {
      throw new Error("Kalender-Event nicht gefunden.");
    }

    const feedId = input.feedId !== undefined ? input.feedId : existing.feedId;
    const feed = feedId
      ? await this.db.calendarFeed.findUnique({ where: { id: feedId } })
      : existing.feed;

    return this.db.calendarEvent.update({
      where: { id },
      data: {
        ...(input.feedId !== undefined ? { feedId: input.feedId } : {}),
        ...(input.worldId !== undefined ? { worldId: input.worldId } : {}),
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        ...(input.title != null ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.location !== undefined ? { location: input.location?.trim() || null } : {}),
        ...(input.startAt != null ? { startAt: input.startAt } : {}),
        ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
        ...(input.allDay != null ? { allDay: input.allDay } : {}),
        ...(input.kind != null ? { kind: input.kind } : {}),
        ...(input.externalUid !== undefined ? { externalUid: input.externalUid } : {}),
        ...(input.metadata !== undefined ? { metadata: toPrismaJsonValue(input.metadata) } : {}),
        caldavPending: feed?.type === "caldav" && feed.direction !== "read_only",
      },
    });
  }

  async deleteEvent(id: string) {
    await this.db.calendarEvent.delete({ where: { id } });
  }

  async upsertExternalEvent(
    feedId: string,
    externalUid: string,
    input: CreateCalendarEventInput,
  ) {
    const existing = await this.db.calendarEvent.findFirst({
      where: { feedId, externalUid },
    });
    if (existing) {
      return this.updateEvent(existing.id, { ...input, externalUid, feedId });
    }
    return this.createEvent({ ...input, externalUid, feedId });
  }

  async markFeedSynced(feedId: string, error: string | null = null) {
    return this.db.calendarFeed.update({
      where: { id: feedId },
      data: {
        lastSyncAt: new Date(),
        syncError: error,
      },
    });
  }

  async ensureLocalFeed(): Promise<{ id: string }> {
    const existing = await this.db.calendarFeed.findFirst({
      where: { type: "local" },
    });
    if (existing) return { id: existing.id };
    const feed = await this.createFeed({
      name: "UWE Kalender",
      type: "local",
      direction: "read_write",
      enabled: true,
    });
    return { id: feed.id };
  }

  async listPendingWriteBackEvents(feedId: string) {
    return this.db.calendarEvent.findMany({
      where: { feedId, caldavPending: true },
      orderBy: { updatedAt: "asc" },
    });
  }

  async markEventSynced(
    eventId: string,
    remote: { remoteHref: string; remoteEtag?: string | null },
  ) {
    return this.db.calendarEvent.update({
      where: { id: eventId },
      data: {
        remoteHref: remote.remoteHref,
        remoteEtag: remote.remoteEtag ?? null,
        caldavPending: false,
      },
    });
  }

  async markEventPendingWrite(eventId: string) {
    return this.db.calendarEvent.update({
      where: { id: eventId },
      data: { caldavPending: true },
    });
  }

  resolveFeedCredentials(feed: { credentialsEnc: string | null }) {
    if (!feed.credentialsEnc) return null;
    return decryptSecret(feed.credentialsEnc, this.encryptionSecret);
  }

  async unsyncSessionFromCalendar(sessionId: string) {
    const linked = await this.db.calendarEvent.findMany({
      where: { sessionId },
      select: { id: true },
    });
    if (linked.length === 0) {
      return { removed: 0 };
    }
    await this.db.calendarEvent.deleteMany({ where: { sessionId } });
    return { removed: linked.length };
  }

  async syncSessionToCalendar(sessionId: string) {
    const session = await this.db.gameSession.findUnique({
      where: { id: sessionId },
      include: { calendarEvents: true },
    });
    if (!session) {
      return null;
    }

    if (!session.date) {
      await this.unsyncSessionFromCalendar(sessionId);
      return null;
    }

    const localFeed = await this.ensureLocalFeed();
    const title = `Session ${session.sessionNumber}: ${session.title}`;
    const startAt = session.date;
    const endAt = new Date(startAt.getTime() + 4 * 60 * 60 * 1000);

    const existing = session.calendarEvents[0]
      ?? (await this.db.calendarEvent.findFirst({
        where: { sessionId: session.id },
      }));

    if (existing) {
      return this.updateEvent(existing.id, {
        feedId: localFeed.id,
        worldId: session.worldId,
        sessionId: session.id,
        title,
        startAt,
        endAt,
        kind: "session",
        externalUid: existing.externalUid ?? `uwe-session-${session.id}`,
      });
    }

    return this.createEvent({
      feedId: localFeed.id,
      worldId: session.worldId,
      sessionId: session.id,
      title,
      startAt,
      endAt,
      kind: "session",
      externalUid: `uwe-session-${session.id}`,
    });
  }

  async syncAllSessionsForWorld(worldId: string) {
    const sessions = await this.db.gameSession.findMany({
      where: { worldId, date: { not: null } },
      orderBy: { sessionNumber: "asc" },
    });

    let synced = 0;
    for (const session of sessions) {
      await this.syncSessionToCalendar(session.id);
      synced += 1;
    }
    return { worldId, synced };
  }
}

export function createCalendarService(db: PrismaClient): CalendarService {
  return new CalendarService(db);
}
