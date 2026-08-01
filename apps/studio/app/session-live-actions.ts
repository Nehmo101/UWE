"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createGameSessionService,
  createQuestLifecycleService,
  createSessionLiveService,
  GameSessionStatusEnum,
  prisma,
  type SessionLiveEntryKind,
} from "@uwe/database/server";
import { SESSION_BOOKMARK_KIND, encodeBookmarkPayload } from "@uwe/session-runner";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

function sessions() {
  return createGameSessionService();
}

function liveEntries() {
  return createSessionLiveService(prisma);
}

const LIVE_ENTRY_KINDS: SessionLiveEntryKind[] = [
  "note",
  "loot",
  "quest_update",
  "npc_update",
  "initiative",
  "bookmark",
];

export async function appendSessionLiveEntryAction(input: {
  worldSlug: string;
  sessionId: string;
  kind: SessionLiveEntryKind;
  content: string;
  refPageId?: string | null;
}): Promise<void> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(input.worldSlug);

  const kind = LIVE_ENTRY_KINDS.includes(input.kind) ? input.kind : "note";
  const content = input.content.trim();
  if (!content) {
    throw new Error("Eintrag darf nicht leer sein.");
  }

  await liveEntries().appendEntry({
    gameSessionId: input.sessionId,
    kind,
    content,
    refPageId: input.refPageId ?? null,
  });
  revalidatePath(`/worlds/${input.worldSlug}/sessions/${input.sessionId}/live`);
}

/**
 * Leseposition des Session-Runners festhalten.
 *
 * Zwei Sorten, und der Unterschied ist wichtig fürs Protokoll:
 *
 * - **automatisch** (`explicit: false`) — bei jedem Seitenwechsel im Lesebereich.
 *   Ersetzt den vorigen automatischen Eintrag, sonst wäre das Live-Protokoll
 *   nach einer Stunde Blättern unlesbar.
 * - **ausdrücklich** — die Spielleitung setzt ein Lesezeichen. Das bleibt stehen
 *   und wird zur Spur durch den Abend.
 */
export async function saveSessionBookmarkAction(input: {
  worldSlug: string;
  sessionId: string;
  pageId: string;
  pageTitle: string;
  anchor?: string | null;
  scrollRatio?: number | null;
  explicit?: boolean;
}): Promise<void> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(input.worldSlug);

  const service = liveEntries();
  const explicit = input.explicit === true;

  if (!explicit) {
    const existing = await service.listEntries(input.sessionId);
    for (const entry of existing) {
      if (entry.kind !== SESSION_BOOKMARK_KIND) continue;
      const payload = entry.payload;
      const isAuto =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).auto === true
          : false;
      if (isAuto) {
        await service.deleteEntry(entry.id);
      }
    }
  }

  await service.appendEntry({
    gameSessionId: input.sessionId,
    kind: SESSION_BOOKMARK_KIND,
    content: input.pageTitle.trim() || "Leseposition",
    refPageId: input.pageId,
    payload: {
      ...encodeBookmarkPayload({
        pageId: input.pageId,
        anchor: input.anchor ?? null,
        scrollRatio: input.scrollRatio ?? null,
      }),
      auto: !explicit,
    },
  });

  if (explicit) {
    revalidatePath(`/worlds/${input.worldSlug}/sessions/${input.sessionId}/live`);
  }
}

export async function deleteSessionLiveEntryAction(input: {
  worldSlug: string;
  sessionId: string;
  entryId: string;
}): Promise<void> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(input.worldSlug);

  await liveEntries().deleteEntry(input.entryId);
  revalidatePath(`/worlds/${input.worldSlug}/sessions/${input.sessionId}/live`);
}

export async function saveSessionRecapDraftAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug") || "");
  const sessionId = String(formData.get("sessionId") || "");
  const summaryDm = String(formData.get("summaryDm") || "");
  await requireStudioWorldEdit(worldSlug);

  await sessions().update(sessionId, { summaryDm });
  revalidatePath(`/worlds/${worldSlug}/sessions/${sessionId}`);
  redirect(`/worlds/${worldSlug}/sessions/${sessionId}/review?saved=1`);
}

export async function updateSessionLiveNotesAction(input: {
  worldSlug: string;
  sessionId: string;
  notes: string;
}): Promise<void> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(input.worldSlug);

  await sessions().update(input.sessionId, { notes: input.notes });
  revalidatePath(`/worlds/${input.worldSlug}/sessions/${input.sessionId}`);
  revalidatePath(`/worlds/${input.worldSlug}/sessions/${input.sessionId}/live`);
}

export async function appendSessionLiveNoteAction(input: {
  worldSlug: string;
  sessionId: string;
  line: string;
}): Promise<{ notes: string }> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(input.worldSlug);

  const session = await sessions().getById(input.sessionId);
  if (!session) {
    throw new Error("Session nicht gefunden.");
  }

  const timestamp = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const prefix = session.notes?.trim() ? `${session.notes.trim()}\n` : "";
  const notes = `${prefix}- [${timestamp}] ${input.line.trim()}`;

  await sessions().update(input.sessionId, { notes });
  revalidatePath(`/worlds/${input.worldSlug}/sessions/${input.sessionId}/live`);

  return { notes };
}

export async function applyQuestStatusFromReviewAction(
  formData: FormData,
): Promise<void> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug") || "");
  const sessionId = String(formData.get("sessionId") || "");
  const pageId = String(formData.get("pageId") || "");
  const status = String(formData.get("status") || "");
  await requireStudioWorldEdit(worldSlug);

  if (!pageId) {
    throw new Error("Quest-Seite fehlt.");
  }
  if (status !== "completed" && status !== "failed") {
    throw new Error("Ungültiger Quest-Status.");
  }

  await createQuestLifecycleService(prisma).updateQuestStatus(pageId, status);
  revalidatePath(`/worlds/${worldSlug}/sessions/${sessionId}/review`);
  redirect(`/worlds/${worldSlug}/sessions/${sessionId}/review?applied=1`);
}

export async function endSessionLiveModeAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug") || "");
  const sessionId = String(formData.get("sessionId") || "");
  await requireStudioWorldEdit(worldSlug);

  await sessions().update(sessionId, { status: GameSessionStatusEnum.played });
  revalidatePath(`/worlds/${worldSlug}/sessions/${sessionId}`);
  redirect(`/worlds/${worldSlug}/sessions/${sessionId}/review`);
}
