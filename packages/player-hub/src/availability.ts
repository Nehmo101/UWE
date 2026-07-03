import type { PrismaClient } from "@uwe/database/server";

export const AVAILABILITY_STATUSES = ["yes", "maybe", "no"] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  yes: "Bin dabei",
  maybe: "Vielleicht",
  no: "Kann nicht",
};

export function normalizeAvailabilityStatus(
  raw: string | null | undefined,
): AvailabilityStatus | null {
  const value = raw?.trim().toLowerCase();
  return (AVAILABILITY_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as AvailabilityStatus)
    : null;
}

export interface AvailabilityVote {
  userId: string;
  displayName: string;
  status: AvailabilityStatus;
  note: string | null;
  updatedAt: Date;
}

export interface SessionAvailabilitySummary {
  sessionId: string;
  votes: AvailabilityVote[];
  counts: Record<AvailabilityStatus, number>;
}

function emptyCounts(): Record<AvailabilityStatus, number> {
  return { yes: 0, maybe: 0, no: 0 };
}

export class SessionAvailabilityService {
  constructor(private readonly db: PrismaClient) {}

  async upsertVote(input: {
    sessionId: string;
    userId: string;
    status: AvailabilityStatus;
    note?: string | null;
  }): Promise<void> {
    await this.db.sessionAvailability.upsert({
      where: {
        sessionId_userId: { sessionId: input.sessionId, userId: input.userId },
      },
      create: {
        sessionId: input.sessionId,
        userId: input.userId,
        status: input.status,
        note: input.note?.trim() || null,
      },
      update: {
        status: input.status,
        note: input.note === undefined ? undefined : input.note?.trim() || null,
      },
    });
  }

  async listForSessions(sessionIds: string[]): Promise<Map<string, SessionAvailabilitySummary>> {
    if (sessionIds.length === 0) {
      return new Map();
    }

    const rows = await this.db.sessionAvailability.findMany({
      where: { sessionId: { in: sessionIds } },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { updatedAt: "asc" },
    });

    const summaries = new Map<string, SessionAvailabilitySummary>();
    for (const sessionId of sessionIds) {
      summaries.set(sessionId, { sessionId, votes: [], counts: emptyCounts() });
    }

    for (const row of rows) {
      const status = normalizeAvailabilityStatus(row.status);
      if (!status) continue;
      const summary = summaries.get(row.sessionId);
      if (!summary) continue;
      summary.votes.push({
        userId: row.userId,
        displayName: row.user.displayName,
        status,
        note: row.note,
        updatedAt: row.updatedAt,
      });
      summary.counts[status] += 1;
    }

    return summaries;
  }
}

export function createSessionAvailabilityService(
  db: PrismaClient,
): SessionAvailabilityService {
  return new SessionAvailabilityService(db);
}
