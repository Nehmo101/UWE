"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPrismaClient, getAppRepository } from "@uwe/database/server";
import { createPlayerGroupService } from "@uwe/player-hub";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

/**
 * Spielergruppen verwalten — ausschließlich hier, nie im Portal.
 *
 * Wer in welcher Runde sitzt, entscheidet der Spielleiter. Das Portal liest
 * die Zuordnung nur; deshalb liegt jeder Schreibpfad im Studio hinter
 * `requireStudioWorldEdit`.
 */

function memberIdsFromForm(formData: FormData): string[] {
  return formData
    .getAll("memberUserId")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

/** Zugang prüfen und die Welt-Id auflösen — jeder Schreibpfad startet hier. */
async function requireWorldId(worldSlug: string): Promise<string> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) {
    throw new Error("Welt nicht gefunden.");
  }
  return world.id;
}

export async function createPlayerGroupAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const campaignId = String(formData.get("campaignId") || "").trim();
  const memberUserIds = memberIdsFromForm(formData);

  const worldId = await requireWorldId(worldSlug);

  const db = createPrismaClient();
  try {
    await createPlayerGroupService(db).create({
      worldId,
      name,
      description: description || null,
      campaignId: campaignId || null,
      memberUserIds,
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/gruppen`);
  redirect(`/worlds/${worldSlug}/gruppen?angelegt=1`);
}

export async function updatePlayerGroupAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const groupId = String(formData.get("groupId"));
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const campaignId = String(formData.get("campaignId") || "").trim();
  const memberUserIds = memberIdsFromForm(formData);

  const worldId = await requireWorldId(worldSlug);

  const db = createPrismaClient();
  try {
    const groups = createPlayerGroupService(db);
    await groups.update(worldId, groupId, {
      name,
      description: description || null,
      campaignId: campaignId || null,
    });
    await groups.setMembers(worldId, groupId, memberUserIds);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/gruppen`);
  redirect(`/worlds/${worldSlug}/gruppen?gespeichert=1`);
}

export async function deletePlayerGroupAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const groupId = String(formData.get("groupId"));

  const worldId = await requireWorldId(worldSlug);

  const db = createPrismaClient();
  try {
    await createPlayerGroupService(db).remove(worldId, groupId);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/gruppen`);
  redirect(`/worlds/${worldSlug}/gruppen?geloescht=1`);
}

/**
 * Quest einer Tischrunde zuordnen — der Weg aus dem Kampagnen-Radar.
 *
 * Leerer Wert nimmt die Zuordnung zurück. Die Quest verschwindet dann aus
 * jedem Portal-Questlog und bleibt nur im Studio sichtbar.
 */
export async function assignQuestToGroupAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const pageId = String(formData.get("pageId"));
  const groupId = String(formData.get("groupId") || "").trim();
  const returnTo = String(formData.get("returnTo") || `/worlds/${worldSlug}/radar`);

  const worldId = await requireWorldId(worldSlug);

  const db = createPrismaClient();
  try {
    await createPlayerGroupService(db).assignQuest(worldId, pageId, groupId || null);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}zugeordnet=1`);
}
