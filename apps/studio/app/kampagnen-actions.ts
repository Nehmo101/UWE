"use server";

import { z } from "zod";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  createPrismaClient,
  createQuestLifecycleService,
  getAppRepository,
  prisma,
  type DungeonPrepStatus,
  type QuestLifecycleStatus,
} from "@uwe/database/server";
import { createCampaignCockpitService } from "@uwe/campaign-cockpit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudioContentEdit, requireStudioWorldEdit } from "@/src/lib/authz";

/*
 * Server Actions für das Kampagnen-Cockpit und den Radar (Muster:
 * dungeon-actions.ts). Alle Aktionen tragen explizite Slug-Felder —
 * kein Pfad-Parsing aus redirectTo.
 */

function repo() {
  return getAppRepository();
}

/**
 * Wohin nach einer Quick-Action zurückgeleitet wird. Validiertes Enum statt
 * freiem Redirect-Ziel: die Aktion bleibt in der Ansicht, aus der sie kam —
 * der alte Weg über den Quest-Editor warf den DM aus dem Radar (und landete
 * wegen der falschen Nav-Kategorie sogar auf einer 404).
 */
const returnTargetSchema = z.enum(["radar", "cockpit", "kapitel", "abschluss"]);

function resolveReturnPath(
  target: z.infer<typeof returnTargetSchema>,
  worldSlug: string,
  campaignSlug: string | null,
  kapitelSlug: string | null,
  sessionId: string | null,
): string {
  const base = `/worlds/${worldSlug}`;
  switch (target) {
    case "radar":
      return `${base}/radar`;
    case "cockpit":
      return `${base}/kampagnen/${campaignSlug ?? ""}`;
    case "kapitel":
      return `${base}/kampagnen/${campaignSlug ?? ""}/kapitel/${kapitelSlug ?? ""}`;
    case "abschluss": {
      const suffix = sessionId ? `?session=${encodeURIComponent(sessionId)}` : "";
      return `${base}/kampagnen/${campaignSlug ?? ""}/abschluss${suffix}`;
    }
  }
}

function parseReturnTarget(formData: FormData) {
  const parsed = returnTargetSchema.safeParse(formData.get("returnTo") ?? "radar");
  if (!parsed.success) {
    throw new Error("Ungültiges Rücksprungziel.");
  }
  return parsed.data;
}

function appendQuery(path: string, key: string, value: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${value}`;
}

const QUEST_STATUSES = new Set<QuestLifecycleStatus | "">(["", "open", "completed", "failed"]);

/**
 * Quest-Status setzen, ohne die Ansicht zu verlassen. Ersetzt im Radar den
 * Umweg über updateQuestStatusAction (der zum Quest-Editor redirectete).
 */
export async function updateQuestStatusInPlaceAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const pageId = String(formData.get("pageId"));
  const rawStatus = String(formData.get("questStatus") ?? "");
  const returnTo = parseReturnTarget(formData);
  const campaignSlug = String(formData.get("campaignSlug") || "") || null;
  const kapitelSlug = String(formData.get("kapitelSlug") || "") || null;
  const sessionId = String(formData.get("sessionId") || "") || null;

  if (!QUEST_STATUSES.has(rawStatus as QuestLifecycleStatus | "")) {
    throw new Error("Ungültiger Quest-Status.");
  }

  await requireStudioContentEdit(worldSlug, pageId);

  const db = createPrismaClient();
  try {
    const page = await repo().getPageById(pageId);
    if (!page || page.type !== "quest") {
      throw new Error("Quest-Status ist nur für Quest-Seiten verfügbar.");
    }
    await createQuestLifecycleService(db).updateQuestStatus(
      pageId,
      rawStatus === "" ? null : (rawStatus as QuestLifecycleStatus),
    );
  } finally {
    await db.$disconnect();
  }

  const returnPath = resolveReturnPath(returnTo, worldSlug, campaignSlug, kapitelSlug, sessionId);
  revalidatePath(returnPath);
  redirect(appendQuery(returnPath, "saved", "1"));
}

const titleSchema = z.string().trim().min(1, "Titel ist erforderlich.");

function parseTitle(formData: FormData): string {
  const result = titleSchema.safeParse(formData.get("title") ?? "");
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Ungültiger Titel.");
  }
  return result.data;
}

const PREP_STATUSES = new Set<DungeonPrepStatus>(["unprepared", "ready", "played", "skipped"]);

function parsePrepStatus(formData: FormData): DungeonPrepStatus {
  const value = String(formData.get("prepStatus") ?? "unprepared") as DungeonPrepStatus;
  if (!PREP_STATUSES.has(value)) {
    throw new Error("Ungültiger Kapitel-Status.");
  }
  return value;
}

async function requireCampaign(worldSlug: string, campaignSlug: string) {
  const campaign = await createCampaignCockpitService(prisma).getCampaign(
    worldSlug,
    campaignSlug,
  );
  if (!campaign) throw new Error("Kampagne nicht gefunden.");
  return campaign;
}

function cockpitPath(worldSlug: string, campaignSlug: string) {
  return `/worlds/${worldSlug}/kampagnen/${campaignSlug}`;
}

export async function createStoryArcAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  await requireStudioWorldEdit(worldSlug);

  const campaign = await requireCampaign(worldSlug, campaignSlug);
  const chapter = await createCampaignCockpitService(prisma).createChapter({
    worldId: campaign.worldId,
    campaignId: campaign.id,
    title: parseTitle(formData),
    summary: String(formData.get("summary") || "") || null,
    content: String(formData.get("content") || "") || undefined,
  });

  revalidatePath(cockpitPath(worldSlug, campaignSlug));
  redirect(`${cockpitPath(worldSlug, campaignSlug)}/kapitel/${chapter.slug}?created=1`);
}

export async function updateStoryArcAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const kapitelSlug = String(formData.get("kapitelSlug"));
  const chapterId = String(formData.get("chapterId"));
  await requireStudioContentEdit(worldSlug, chapterId);

  await requireCampaign(worldSlug, campaignSlug);
  await createCampaignCockpitService(prisma).updateChapter(chapterId, {
    prepStatus: parsePrepStatus(formData),
    ...(formData.has("title") ? { title: parseTitle(formData) } : {}),
    ...(formData.has("summary")
      ? { summary: String(formData.get("summary") || "") || null }
      : {}),
  });

  const kapitelPath = `${cockpitPath(worldSlug, campaignSlug)}/kapitel/${kapitelSlug}`;
  revalidatePath(kapitelPath);
  revalidatePath(cockpitPath(worldSlug, campaignSlug));
  redirect(`${kapitelPath}?saved=1`);
}

export async function moveStoryArcAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const chapterId = String(formData.get("chapterId"));
  const direction = String(formData.get("direction"));
  if (direction !== "up" && direction !== "down") {
    throw new Error("Ungültige Richtung.");
  }
  await requireStudioWorldEdit(worldSlug);

  const campaign = await requireCampaign(worldSlug, campaignSlug);
  await createCampaignCockpitService(prisma).moveChapter(
    campaign.worldId,
    campaign.id,
    chapterId,
    direction,
  );

  revalidatePath(cockpitPath(worldSlug, campaignSlug));
  redirect(`${cockpitPath(worldSlug, campaignSlug)}?saved=1`);
}

export async function assignQuestToArcAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const kapitelSlug = String(formData.get("kapitelSlug") || "") || null;
  const questId = String(formData.get("questId"));
  const chapterId = String(formData.get("chapterId") || "") || null;
  await requireStudioContentEdit(worldSlug, questId);

  const campaign = await requireCampaign(worldSlug, campaignSlug);
  await createCampaignCockpitService(prisma).assignQuestToChapter(
    campaign.worldId,
    questId,
    chapterId,
  );

  const returnPath = kapitelSlug
    ? `${cockpitPath(worldSlug, campaignSlug)}/kapitel/${kapitelSlug}`
    : cockpitPath(worldSlug, campaignSlug);
  revalidatePath(returnPath);
  redirect(`${returnPath}?saved=1`);
}
