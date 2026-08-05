"use server";

import { z } from "zod";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  createPrismaClient,
  createQuestLifecycleService,
  getAppRepository,
  type QuestLifecycleStatus,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudioContentEdit } from "@/src/lib/authz";

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
