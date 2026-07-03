"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@uwe/database/server";
import { createMagicItemService } from "@uwe/database/magic-item-service";
import type { MagicItemData } from "@uwe/database/magic-item";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

function parseLines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function saveMagicItemAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug") || "");
  const worldId = String(formData.get("worldId") || "");
  const pageId = String(formData.get("pageId") || "");
  await requireStudioWorldEdit(worldSlug);

  const data: MagicItemData = {
    itemType: String(formData.get("itemType") || "").trim() || undefined,
    rarity: String(formData.get("rarity") || "").trim() || undefined,
    requiresAttunement: formData.get("requiresAttunement") === "on",
    attunementNote: String(formData.get("attunementNote") || "").trim() || undefined,
    visibleDescription: String(formData.get("visibleDescription") || "").trim() || undefined,
    properties: parseLines(formData.get("properties")),
    dmSecret: String(formData.get("dmSecret") || "").trim() || undefined,
    curse: String(formData.get("curse") || "").trim() || undefined,
  };

  await createMagicItemService(prisma).upsertForPage({ worldId, pageId, data });
  revalidatePath(`/worlds/${worldSlug}/magic-items/${pageId}`);
  redirect(`/worlds/${worldSlug}/magic-items/${pageId}?saved=1`);
}
