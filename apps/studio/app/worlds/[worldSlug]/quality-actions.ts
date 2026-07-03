"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createWikitextConvertService, prisma } from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

/**
 * Verlinkt alle unverlinkten Begriffe der Welt gebündelt (nur Auto-Linking,
 * ohne Struktur-Umbau). Nutzt die Bulk-Maschinerie des Wikitext-Convert-Service
 * mit Undo-Snapshot und Activity-Log und leitet zurück zur Wiki-Aufräumzentrale.
 */
export async function runBulkAutoLinkAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug") || "");
  await requireStudioWorldEdit(worldSlug);

  const result = await createWikitextConvertService(prisma).applyWorldConversion(
    worldSlug,
    { autoLink: true, structure: false },
  );

  if (result.ok && result.changedBlockCount > 0) {
    revalidatePath(`/worlds/${worldSlug}`);
    revalidatePath(`/worlds/${worldSlug}/quality`);
    revalidatePath(`/worlds/${worldSlug}/import`);
    revalidatePath(`/worlds/${worldSlug}/graph`);
  }

  redirect(`/worlds/${worldSlug}/quality?linked=${result.addedLinkCount}`);
}
