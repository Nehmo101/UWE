"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createPrismaClient, getAppRepository } from "@uwe/database/server";
import { createPlayerCharacterService } from "@uwe/player-hub";

import { requireStudioWorldEdit } from "@/src/lib/authz";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";

function charactersPath(worldSlug: string): string {
  return `/worlds/${worldSlug}/characters`;
}

async function requireWorld(worldSlug: string) {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) throw new Error("Welt nicht gefunden.");
  return world;
}

export async function createAssignedCharacterAction(formData: FormData): Promise<void> {
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const world = await requireWorld(worldSlug);
  const db = createPrismaClient();
  try {
    const result = await createPlayerCharacterService(db).createAssignedCharacter({
      worldId: world.id,
      ownerUserId: String(formData.get("ownerUserId") ?? "").trim(),
      campaignId: String(formData.get("campaignId") ?? "").trim() || null,
      displayName: String(formData.get("displayName") ?? ""),
    });
    if (!result.ok) throw new Error(result.error);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(charactersPath(worldSlug));
  revalidatePath(`/worlds/${worldSlug}/kampagnen`);
  redirect(`${charactersPath(worldSlug)}?angelegt=1`);
}

export async function updateCharacterAssignmentAction(formData: FormData): Promise<void> {
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const world = await requireWorld(worldSlug);
  const db = createPrismaClient();
  try {
    const result = await createPlayerCharacterService(db).updateAssignment({
      worldId: world.id,
      characterId: String(formData.get("characterId") ?? "").trim(),
      ownerUserId: String(formData.get("ownerUserId") ?? "").trim(),
      campaignId: String(formData.get("campaignId") ?? "").trim() || null,
    });
    if (!result.ok) throw new Error(result.error);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(charactersPath(worldSlug));
  revalidatePath(`/worlds/${worldSlug}/kampagnen`);
  redirect(`${charactersPath(worldSlug)}?zugewiesen=1`);
}
