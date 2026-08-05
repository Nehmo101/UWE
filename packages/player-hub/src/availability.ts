import type { PrismaClient } from "@uwe/database/server";
import {
  normalizeAvailabilityStatus,
  type AvailabilityStatus,
  type SessionAvailabilitySummary,
} from "./portal-types";

// Die client-sicheren Teile liegen in portal-types.ts und werden hier weiter
// ausgegeben, damit bestehende Aufrufer unveraendert bleiben.
export {
  AVAILABILITY_LABELS,
  AVAILABILITY_STATUSES,
  normalizeAvailabilityStatus,
  type AvailabilityStatus,
  type AvailabilityVote,
  type SessionAvailabilitySummary,
} from "./portal-types";

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
