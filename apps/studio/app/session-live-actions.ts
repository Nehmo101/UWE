"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createGameSessionService, GameSessionStatusEnum } from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

function sessions() {
  return createGameSessionService();
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

export async function endSessionLiveModeAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug") || "");
  const sessionId = String(formData.get("sessionId") || "");
  await requireStudioWorldEdit(worldSlug);

  await sessions().update(sessionId, { status: GameSessionStatusEnum.played });
  revalidatePath(`/worlds/${worldSlug}/sessions/${sessionId}`);
  redirect(`/worlds/${worldSlug}/sessions/${sessionId}?saved=1`);
}
