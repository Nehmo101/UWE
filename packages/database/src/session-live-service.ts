import type { PrismaClient } from "./client";
import type { SessionLiveEntryKind } from "./generated/prisma/client";

/**
 * Session live mode: structured entries captured at the table during a session.
 *
 * Nothing written here is canon. Entries are grouped into a review draft after the
 * session (`buildSessionReviewDraft`) so the DM confirms loot/quest/NPC changes
 * through the normal Proposal → Review → Apply flow — never auto-applied.
 *
 * Lives in packages/database because it is a thin repository over GameSession; kept
 * small and separate from the (frozen) game-session service.
 */

export type { SessionLiveEntryKind };

export interface SessionLiveEntryRecord {
  id: string;
  gameSessionId: string;
  kind: SessionLiveEntryKind;
  content: string;
  refPageId: string | null;
  payload: unknown;
  createdAt: Date;
}

export interface AppendSessionLiveEntryInput {
  gameSessionId: string;
  kind: SessionLiveEntryKind;
  content: string;
  refPageId?: string | null;
  payload?: unknown;
}

/** Entries grouped by kind — the shape the review page renders. */
export interface SessionReviewDraft {
  notes: SessionLiveEntryRecord[];
  loot: SessionLiveEntryRecord[];
  questUpdates: SessionLiveEntryRecord[];
  npcUpdates: SessionLiveEntryRecord[];
  initiative: SessionLiveEntryRecord[];
  bookmarks: SessionLiveEntryRecord[];
  total: number;
}

const KIND_LABELS: Record<SessionLiveEntryKind, string> = {
  note: "Notiz",
  loot: "Beute",
  quest_update: "Quest-Update",
  npc_update: "NPC-Update",
  initiative: "Initiative",
  bookmark: "Lesezeichen",
};

export function sessionLiveKindLabel(kind: SessionLiveEntryKind): string {
  return KIND_LABELS[kind] ?? kind;
}

/**
 * Pure grouping of live entries into a review draft. Fully testable without a DB.
 * Entries are assumed to be in chronological order.
 */
export function buildSessionReviewDraft(
  entries: SessionLiveEntryRecord[],
): SessionReviewDraft {
  const draft: SessionReviewDraft = {
    notes: [],
    loot: [],
    questUpdates: [],
    npcUpdates: [],
    initiative: [],
    bookmarks: [],
    total: entries.length,
  };

  for (const entry of entries) {
    switch (entry.kind) {
      case "loot":
        draft.loot.push(entry);
        break;
      case "quest_update":
        draft.questUpdates.push(entry);
        break;
      case "npc_update":
        draft.npcUpdates.push(entry);
        break;
      case "initiative":
        draft.initiative.push(entry);
        break;
      case "bookmark":
        draft.bookmarks.push(entry);
        break;
      default:
        draft.notes.push(entry);
    }
  }

  return draft;
}

const TIME_FORMAT = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Heuristic recap draft (a `summaryDm` suggestion) built from the live entries — the
 * same spirit as prepare-session.ts. It is only a starting point for the DM, never
 * saved automatically.
 */
export function buildRecapDraft(entries: SessionLiveEntryRecord[]): string {
  if (entries.length === 0) return "";

  const draft = buildSessionReviewDraft(entries);
  const lines: string[] = [];

  const section = (title: string, rows: SessionLiveEntryRecord[]) => {
    const filled = rows.filter((row) => row.content.trim());
    if (filled.length === 0) return;
    lines.push(`## ${title}`);
    for (const row of filled) {
      lines.push(`- [${TIME_FORMAT.format(row.createdAt)}] ${row.content.trim()}`);
    }
    lines.push("");
  };

  section("Verlauf", draft.notes);
  section("Beute", draft.loot);
  section("Quest-Änderungen", draft.questUpdates);
  section("NPCs", draft.npcUpdates);
  section("Lesezeichen", draft.bookmarks);

  return lines.join("\n").trim();
}

export class SessionLiveService {
  constructor(private readonly db: PrismaClient) {}

  async appendEntry(input: AppendSessionLiveEntryInput): Promise<SessionLiveEntryRecord> {
    const entry = await this.db.sessionLiveEntry.create({
      data: {
        gameSessionId: input.gameSessionId,
        kind: input.kind,
        content: input.content.trim(),
        refPageId: input.refPageId ?? null,
        payload:
          input.payload === undefined
            ? undefined
            : (input.payload as import("./generated/prisma/client").Prisma.InputJsonValue),
      },
    });
    return toRecord(entry);
  }

  async listEntries(gameSessionId: string): Promise<SessionLiveEntryRecord[]> {
    const entries = await this.db.sessionLiveEntry.findMany({
      where: { gameSessionId },
      orderBy: { createdAt: "asc" },
    });
    return entries.map(toRecord);
  }

  async deleteEntry(id: string): Promise<void> {
    await this.db.sessionLiveEntry.delete({ where: { id } });
  }

  async getReviewDraft(gameSessionId: string): Promise<SessionReviewDraft> {
    return buildSessionReviewDraft(await this.listEntries(gameSessionId));
  }
}

function toRecord(entry: {
  id: string;
  gameSessionId: string;
  kind: SessionLiveEntryKind;
  content: string;
  refPageId: string | null;
  payload: unknown;
  createdAt: Date;
}): SessionLiveEntryRecord {
  return {
    id: entry.id,
    gameSessionId: entry.gameSessionId,
    kind: entry.kind,
    content: entry.content,
    refPageId: entry.refPageId,
    payload: entry.payload ?? null,
    createdAt: entry.createdAt,
  };
}

export function createSessionLiveService(db: PrismaClient): SessionLiveService {
  return new SessionLiveService(db);
}
