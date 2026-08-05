"use server";
import { familyPrisma } from "@uwe/database/family-client";

import { z } from "zod";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  createCalendarService,
  createGameSessionService,
  getAppRepository,
  prisma,
  type GameSessionStatus,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudioWorldEdit } from "@/src/lib/authz";

const GAME_SESSION_STATUSES = [
  "planned",
  "prepared",
  "played",
  "summarized",
  "archived",
] as const;

const createSessionSchema = z.object({
  title: z.string().trim().min(1, "Titel ist erforderlich."),
  date: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => value === undefined || !Number.isNaN(new Date(value).getTime()), {
      message: "Ungültiges Datum.",
    }),
  status: z.enum(GAME_SESSION_STATUSES).optional(),
});

function sessions() {
  return createGameSessionService();
}

function repo() {
  return getAppRepository();
}

export async function createGameSessionAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("Welt nicht gefunden.");

  const parsed = createSessionSchema.safeParse({
    title: formData.get("title") ?? "",
    date: formData.get("date") ?? undefined,
    status: formData.get("status") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  const campaignSlug = String(formData.get("campaignSlug") || "");
  const campaign = campaignSlug
    ? await repo().getCampaignBySlug(worldSlug, campaignSlug)
    : null;

  const sessionNumber = await sessions().getNextSessionNumber(
    world.id,
    campaign?.id ?? null,
  );

  const session = await sessions().create({
    worldId: world.id,
    campaignId: campaign?.id ?? null,
    storyArcPageId: String(formData.get("storyArcPageId") || "") || null,
    title: parsed.data.title,
    sessionNumber,
    date: parsed.data.date ? new Date(parsed.data.date) : null,
    status: (parsed.data.status as GameSessionStatus | undefined) ?? "planned",
    summaryDm: String(formData.get("summaryDm") || "") || null,
    summaryPlayer: String(formData.get("summaryPlayer") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    openPlots: String(formData.get("openPlots") || "") || null,
    playerDecisions: String(formData.get("playerDecisions") || "") || null,
  });

  // Terminierte Sessions automatisch als Kalender-Event spiegeln.
  await createCalendarService(familyPrisma, prisma).syncSessionToCalendar(session.id);

  revalidatePath(`/worlds/${worldSlug}/sessions`);
  redirect(`/worlds/${worldSlug}/sessions/${session.id}`);
}

export async function updateGameSessionAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const sessionId = String(formData.get("sessionId"));

  await requireStudioWorldEdit(worldSlug);

  // Page links are managed via dedicated link/unlink actions; only overwrite
  // them when the form explicitly submits the field.
  const linkedPageIds = formData.has("linkedPageIds")
    ? String(formData.get("linkedPageIds") || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : undefined;

  await sessions().update(sessionId, {
    title: String(formData.get("title")),
    sessionNumber: Number(formData.get("sessionNumber")),
    date: formData.get("date") ? new Date(String(formData.get("date"))) : null,
    status: formData.get("status") as GameSessionStatus,
    // Kapitel nur anfassen, wenn das Formular das Feld mitschickt (Select ist
    // immer dabei, leerer Wert = bewusst kein Kapitel).
    ...(formData.has("storyArcPageId")
      ? { storyArcPageId: String(formData.get("storyArcPageId") || "") || null }
      : {}),
    summaryDm: String(formData.get("summaryDm") || "") || null,
    summaryPlayer: String(formData.get("summaryPlayer") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    openPlots: String(formData.get("openPlots") || "") || null,
    playerDecisions: String(formData.get("playerDecisions") || "") || null,
    playerVisibleSchedule: formData.get("playerVisibleSchedule") === "on",
    linkedPageIds,
  });

  // Kalender-Event nachziehen (legt an, verschiebt oder entfernt bei leerem Datum).
  await createCalendarService(familyPrisma, prisma).syncSessionToCalendar(sessionId);

  revalidatePath(`/worlds/${worldSlug}/sessions`);
  revalidatePath(`/worlds/${worldSlug}/sessions/${sessionId}`);
  redirect(`/worlds/${worldSlug}/sessions/${sessionId}?saved=1`);
}

export async function deleteGameSessionAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const sessionId = String(formData.get("sessionId"));

  await requireStudioWorldEdit(worldSlug);

  const removed = await sessions().remove(worldSlug, sessionId);
  if (!removed) {
    throw new Error("Session nicht gefunden.");
  }

  revalidatePath(`/worlds/${worldSlug}/sessions`);
  revalidatePath(`/auth/worlds/${worldSlug}/sessions`);
  redirect(`/worlds/${worldSlug}/sessions?deleted=1`);
}

export async function publishSessionRecapAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const sessionId = String(formData.get("sessionId"));

  await requireStudioWorldEdit(worldSlug);

  await sessions().publishRecap(sessionId);

  revalidatePath(`/worlds/${worldSlug}/sessions`);
  revalidatePath(`/worlds/${worldSlug}/sessions/${sessionId}`);
  revalidatePath(`/auth/worlds/${worldSlug}/sessions`);
  redirect(`/worlds/${worldSlug}/sessions/${sessionId}?published=1`);
}

export async function linkPageToSessionAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const sessionId = String(formData.get("sessionId"));
  const pageId = String(formData.get("pageId"));

  await requireStudioWorldEdit(worldSlug);

  await sessions().linkPage(sessionId, pageId);

  revalidatePath(`/worlds/${worldSlug}/sessions/${sessionId}`);
  redirect(`/worlds/${worldSlug}/sessions/${sessionId}?linked=1`);
}

export async function unlinkPageFromSessionAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const sessionId = String(formData.get("sessionId"));
  const pageId = String(formData.get("pageId"));

  await requireStudioWorldEdit(worldSlug);

  await sessions().unlinkPage(sessionId, pageId);

  revalidatePath(`/worlds/${worldSlug}/sessions/${sessionId}`);
  redirect(`/worlds/${worldSlug}/sessions/${sessionId}?unlinked=1`);
}
