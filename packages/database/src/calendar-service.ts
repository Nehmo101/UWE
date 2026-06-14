import type {
  CalendarEventKind,
  CalendarFeedDirection,
  CalendarFeedType,
  Prisma,
} from "./generated/prisma/client";
import type { PrismaClient } from "./client";

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

function toJson(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class CalendarService {
  constructor(private readonly db: PrismaClient) {}

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
    return this.db.calendarFeed.create({
      data: {
        name: input.name.trim(),
        type: input.type,
        direction: input.direction ?? "read_only",
        url: input.url?.trim() || null,
        caldavUrl: input.caldavUrl?.trim() || null,
        username: input.username?.trim() || null,
        enabled: input.enabled ?? true,
        color: input.color?.trim() || null,
        metadata: toJson(input.metadata),
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
        ...(input.enabled != null ? { enabled: input.enabled } : {}),
        ...(input.color !== undefined ? { color: input.color?.trim() || null } : {}),
        ...(input.metadata !== undefined ? { metadata: toJson(input.metadata) } : {}),
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

  async createEvent(input: CreateCalendarEventInput) {
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
        metadata: toJson(input.metadata),
      },
    });
  }

  async updateEvent(id: string, input: Partial<CreateCalendarEventInput>) {
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
        ...(input.metadata !== undefined ? { metadata: toJson(input.metadata) } : {}),
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
}

export function createCalendarService(db: PrismaClient): CalendarService {
  return new CalendarService(db);
}
