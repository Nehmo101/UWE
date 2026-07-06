"use server";

import { requirePortalActionAuth } from "@/src/lib/portal-action-auth";
import { revalidatePath } from "next/cache";
import { createPartyTreasuryService, createPrismaClient } from "@uwe/database/server";
import {
  parseFormDataOrThrow,
  treasuryItemAssignSchema,
  treasuryItemReturnSchema,
} from "@uwe/security";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";

function revalidateTreasuryPaths(worldSlug: string, returnPath?: string) {
  revalidatePath(`/auth/worlds/${worldSlug}/treasury`);
  revalidatePath(`/auth/worlds/${worldSlug}/characters`);
  if (returnPath) {
    revalidatePath(returnPath);
  }
}

/** Spieler übernimmt ein Treasury-Item in das Inventar eines EIGENEN Charakters. */
export async function assignTreasuryItemToCharacterAction(formData: FormData) {
  await requirePortalActionAuth();
  const parsed = parseFormDataOrThrow(formData, treasuryItemAssignSchema);

  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(parsed.worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }

  const db = createPrismaClient();
  try {
    const treasury = createPartyTreasuryService(db);
    const moved = await treasury.moveItemForViewer(parsed.worldSlug, ctx, {
      itemId: parsed.itemId,
      targetCharacterId: parsed.characterId,
    });
    if (!moved) {
      throw new Error("Keine Berechtigung");
    }
  } finally {
    await db.$disconnect();
  }

  revalidateTreasuryPaths(parsed.worldSlug, parsed.returnPath);
}

/** Spieler legt ein Item aus dem EIGENEN Charakter-Inventar zurück in die Schatzkammer. */
export async function returnTreasuryItemFromCharacterAction(formData: FormData) {
  await requirePortalActionAuth();
  const parsed = parseFormDataOrThrow(formData, treasuryItemReturnSchema);

  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(parsed.worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }

  const db = createPrismaClient();
  try {
    const treasury = createPartyTreasuryService(db);
    const moved = await treasury.moveItemForViewer(parsed.worldSlug, ctx, {
      itemId: parsed.itemId,
      targetCharacterId: null,
    });
    if (!moved) {
      throw new Error("Keine Berechtigung");
    }
  } finally {
    await db.$disconnect();
  }

  revalidateTreasuryPaths(parsed.worldSlug, parsed.returnPath);
}
