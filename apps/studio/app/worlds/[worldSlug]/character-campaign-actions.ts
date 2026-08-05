"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPrismaClient, getAppRepository } from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

/**
 * Charakter ↔ Kampagne — die Zuweisung, die im Studio bleibt.
 *
 * Der Charakter selbst entsteht im Portal: er gehört dem Spieler, und der
 * Spieler pflegt seinen Bogen. Wer in welcher Kampagne mitspielt, entscheidet
 * dagegen der Spielleiter — deshalb liegt genau diese eine Eigenschaft hier
 * und nirgends sonst.
 *
 * Der Schreibvorgang läuft über `updateMany` mit `worldId` im `where`. Eine
 * Charakter-Id aus einer fremden Welt wird dadurch nicht dadurch gültig, dass
 * sie existiert.
 */
export async function assignCharacterToCampaignAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const characterId = String(formData.get("characterId"));
  const campaignId = String(formData.get("campaignId") || "").trim();
  const returnTo = String(formData.get("returnTo") || `/worlds/${worldSlug}/kampagnen`);

  await requireStudioWorldEdit(worldSlug);

  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) {
    throw new Error("Welt nicht gefunden.");
  }

  const db = createPrismaClient();
  try {
    if (campaignId) {
      const campaign = await db.campaign.findFirst({
        where: { id: campaignId, worldId: world.id },
        select: { id: true },
      });
      if (!campaign) {
        throw new Error("Kampagne gehört nicht zu dieser Welt.");
      }
    }

    await db.character.updateMany({
      where: { id: characterId, worldId: world.id },
      data: { campaignId: campaignId || null },
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}zugewiesen=1`);
}
