import type {
  CalendarEventKind,
  CalendarFeedDirection,
  CalendarFeedType,
  Prisma,
} from "./generated/prisma-family/client";
import type { PrismaClient } from "./client";
import type { FamilyPrismaClient } from "./family-client";
import { toPrismaJsonValue } from "./json-utils";
import { decryptSecret, encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";

export type {
  CalendarEvent,
  CalendarFeed,
  CalendarEventKind,
  CalendarFeedType,
  CalendarFeedDirection,
} from "./generated/prisma-family/client";

export {
  CalendarEventKind as CalendarEventKindEnum,
  CalendarFeedType as CalendarFeedTypeEnum,
  CalendarFeedDirection as CalendarFeedDirectionEnum,
} from "./generated/prisma-family/client";

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
  /** When false, imported external events do not enter CalDAV write-back queue. */
  caldavPending?: boolean;
  remoteHref?: string | null;
  remoteEtag?: string | null;
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
    private readonly familyDb: FamilyPrismaClient,
    private readonly coreDb: PrismaClient,
    private readonly encryptionSecret: string = resolveTokenEncryptionSecret(),
  ) {}

  async listFeeds(includeDisabled = false) {
    return this.familyDb.calendarFeed.findMany({
      where: includeDisabled ? undefined : { enabled: true },
      orderBy: { name: "asc" },
    });
  }

  async getFeed(id: string) {
    return this.familyDb.calendarFeed.findUnique({ where: { id } });
  }

  async createFeed(input: CreateCalendarFeedInput) {
    const password = input.password?.trim();
    return this.familyDb.calendarFeed.create({
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
    return this.familyDb.calendarFeed.update({
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
    await this.familyDb.calendarFeed.delete({ where: { id } });
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
    return this.familyDb.calendarEvent.findMany({
      where,
      orderBy: { startAt: "asc" },
      take: options.limit ?? 500,
      include: { feed: true },
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

    return this.familyDb.calendarEvent.findMany({
      where,
      orderBy: { startAt: "asc" },
      take: options.limit ?? 500,
      include: { feed: true },
    });
  }

  async createEvent(input: CreateCalendarEventInput) {
    const feed = input.feedId
      ? await this.familyDb.calendarFeed.findUnique({ where: { id: input.feedId } })
      : null;

    return this.familyDb.calendarEvent.create({
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
        caldavPending:
          input.caldavPending ??
          (input.kind !== "external" &&
            feed?.type === "caldav" &&
            feed.direction !== "read_only"),
        ...(input.remoteHref !== undefined ? { remoteHref: input.remoteHref } : {}),
        ...(input.remoteEtag !== undefined ? { remoteEtag: input.remoteEtag } : {}),
      },
    });
  }

  async updateEvent(id: string, input: Partial<CreateCalendarEventInput>) {
    const existing = await this.familyDb.calendarEvent.findUnique({
      where: { id },
      include: { feed: true },
    });
    if (!existing) {
      throw new Error("Kalender-Event nicht gefunden.");
    }

    const feedId = input.feedId !== undefined ? input.feedId : existing.feedId;
    const feed = feedId
      ? await this.familyDb.calendarFeed.findUnique({ where: { id: feedId } })
      : existing.feed;
    const effectiveKind = input.kind ?? existing.kind;

    return this.familyDb.calendarEvent.update({
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
        ...(input.remoteHref !== undefined ? { remoteHref: input.remoteHref } : {}),
        ...(input.remoteEtag !== undefined ? { remoteEtag: input.remoteEtag } : {}),
        caldavPending:
          input.caldavPending ??
          (effectiveKind !== "external" &&
            feed?.type === "caldav" &&
            feed.direction !== "read_only"),
      },
    });
  }

  async deleteEvent(id: string) {
    await this.familyDb.calendarEvent.delete({ where: { id } });
  }

  async upsertExternalEvent(
    feedId: string,
    externalUid: string,
    input: CreateCalendarEventInput,
  ) {
    const existing = await this.familyDb.calendarEvent.findFirst({
      where: { feedId, externalUid },
    });
    const payload = {
      ...input,
      externalUid,
      feedId,
      kind: input.kind ?? "external",
      caldavPending: false,
    };
    if (existing) {
      return this.updateEvent(existing.id, payload);
    }
    return this.createEvent(payload);
  }

  async deleteExternalEventsNotInUids(feedId: string, uids: string[]) {
    if (uids.length === 0) {
      await this.familyDb.calendarEvent.deleteMany({
        where: { feedId, kind: "external" },
      });
      return;
    }
    await this.familyDb.calendarEvent.deleteMany({
      where: {
        feedId,
        kind: "external",
        externalUid: { notIn: uids },
      },
    });
  }

  async mergeFeedSyncMetadata(
    feedId: string,
    patch: { syncToken?: string | null; ctag?: string | null; lastMethod?: string },
  ) {
    // Read-modify-write der Feed-Metadaten in einer Transaktion, damit
    // parallele Sync-Läufe sich nicht gegenseitig überschreiben (Lost Update).
    return this.familyDb.$transaction(async (tx) => {
      const feed = await tx.calendarFeed.findUnique({ where: { id: feedId } });
      if (!feed) return null;
      const current =
        feed.metadata && typeof feed.metadata === "object" && !Array.isArray(feed.metadata)
          ? (feed.metadata as Record<string, unknown>)
          : {};
      const next = {
        ...current,
        ...(patch.syncToken !== undefined ? { caldavSyncToken: patch.syncToken } : {}),
        ...(patch.ctag !== undefined ? { caldavCTag: patch.ctag } : {}),
        ...(patch.lastMethod ? { caldavLastMethod: patch.lastMethod } : {}),
      };
      return tx.calendarFeed.update({
        where: { id: feedId },
        data: { metadata: toPrismaJsonValue(next) },
      });
    });
  }

  async markFeedSynced(feedId: string, error: string | null = null) {
    return this.familyDb.calendarFeed.update({
      where: { id: feedId },
      data: {
        lastSyncAt: new Date(),
        syncError: error,
      },
    });
  }

  async ensureLocalFeed(): Promise<{ id: string }> {
    const existing = await this.familyDb.calendarFeed.findFirst({
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
    return this.familyDb.calendarEvent.findMany({
      where: { feedId, caldavPending: true },
      orderBy: { updatedAt: "asc" },
    });
  }

  async markEventSynced(
    eventId: string,
    remote: { remoteHref: string; remoteEtag?: string | null },
  ) {
    return this.familyDb.calendarEvent.update({
      where: { id: eventId },
      data: {
        remoteHref: remote.remoteHref,
        remoteEtag: remote.remoteEtag ?? null,
        caldavPending: false,
      },
    });
  }

  async markEventPendingWrite(eventId: string) {
    return this.familyDb.calendarEvent.update({
      where: { id: eventId },
      data: { caldavPending: true },
    });
  }

  resolveFeedCredentials(feed: { credentialsEnc: string | null }) {
    if (!feed.credentialsEnc) return null;
    return decryptSecret(feed.credentialsEnc, this.encryptionSecret);
  }

  async unsyncSessionFromCalendar(sessionId: string) {
    const linked = await this.familyDb.calendarEvent.findMany({
      where: { sessionId },
      select: { id: true },
    });
    if (linked.length === 0) {
      return { removed: 0 };
    }
    await this.familyDb.calendarEvent.deleteMany({ where: { sessionId } });
    return { removed: linked.length };
  }

  async syncSessionToCalendar(sessionId: string) {
    // gameSession lives in the core DB; its calendarEvents back-relation was
    // severed by the split, so the linked event is fetched from familyDb below.
    const session = await this.coreDb.gameSession.findUnique({
      where: { id: sessionId },
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

    const existing = await this.familyDb.calendarEvent.findFirst({
      where: { sessionId: session.id },
    });

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
    const sessions = await this.coreDb.gameSession.findMany({
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

  /**
   * Mirrors upcoming contract deadlines (cancel-by, next payment/renewal) into
   * the local calendar feed so they show up in calendar views and .ics export.
   * Stale contract events (cancelled contracts, moved dates) are pruned.
   */
  async syncContractDeadlinesToCalendar(options: { now?: Date; horizonDays?: number } = {}) {
    const now = options.now ?? new Date();
    const horizonMs = (options.horizonDays ?? 90) * 86_400_000;

    const contracts = await this.familyDb.contractExpense.findMany({
      where: { status: { in: ["active", "review"] } },
    });
    const localFeed = await this.ensureLocalFeed();
    const activeUids: string[] = [];
    let synced = 0;

    for (const contract of contracts) {
      const deadlines = [
        {
          suffix: "cancel",
          date: contract.cancelByDate,
          title: `Kündigungsfrist: ${contract.name}`,
        },
        {
          suffix: "payment",
          date: contract.nextPaymentDate ?? contract.renewalDate,
          title: `Zahlung fällig: ${contract.name}`,
        },
      ];

      for (const deadline of deadlines) {
        if (!deadline.date) continue;
        const delta = deadline.date.getTime() - now.getTime();
        if (delta < 0 || delta > horizonMs) continue;

        const uid = `uwe-contract-${contract.id}-${deadline.suffix}`;
        activeUids.push(uid);
        await this.upsertExternalEvent(localFeed.id, uid, {
          title: deadline.title,
          startAt: deadline.date,
          allDay: true,
          kind: "personal",
          metadata: {
            source: "contract",
            contractId: contract.id,
            deadline: deadline.suffix,
          },
        });
        synced += 1;
      }
    }

    const pruned = await this.familyDb.calendarEvent.deleteMany({
      where: {
        feedId: localFeed.id,
        externalUid: { startsWith: "uwe-contract-", notIn: activeUids },
      },
    });

    return { synced, pruned: pruned.count };
  }
}

export function createCalendarService(
  familyDb: FamilyPrismaClient,
  coreDb: PrismaClient,
): CalendarService {
  return new CalendarService(familyDb, coreDb);
}
