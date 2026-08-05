"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCampaignService, CampaignServiceError } from "@uwe/database/campaign";
import { prisma } from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

/**
 * Kampagnen anlegen, umbenennen und löschen.
 *
 * Die Fachlogik (Slug, Namenskollision, Löschbestätigung) sitzt im Service
 * `@uwe/database/campaign`; hier bleiben Guard, Formular-Parsing und der
 * Rücksprung auf die Verwaltungsseite.
 */

function campaigns() {
  return createCampaignService(prisma);
}

function campaignsPath(worldSlug: string) {
  return `/worlds/${worldSlug}/kampagnen`;
}

/** Kampagnen-Slugs stecken in Filter-Links quer durch das Welt-Cockpit. */
function revalidateWorld(worldSlug: string) {
  revalidatePath(campaignsPath(worldSlug));
  revalidatePath(`/worlds/${worldSlug}`, "layout");
}

function readWorldSlug(formData: FormData): string {
  const worldSlug = String(formData.get("worldSlug") || "").trim();
  if (!worldSlug) throw new Error("Welt fehlt.");
  return worldSlug;
}

/**
 * Fehler des Services werden als `?error=` zurückgegeben statt geworfen: sie
 * sind Eingabefehler des Nutzers („Name schon vergeben"), keine Störung.
 */
function backWithError(worldSlug: string, error: unknown): never {
  if (error instanceof CampaignServiceError) {
    redirect(`${campaignsPath(worldSlug)}?error=${encodeURIComponent(error.message)}`);
  }
  throw error;
}

export async function createCampaignAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = readWorldSlug(formData);
  await requireStudioWorldEdit(worldSlug);

  try {
    await campaigns().create({
      worldSlug,
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
    });
  } catch (error) {
    backWithError(worldSlug, error);
  }

  revalidateWorld(worldSlug);
  redirect(`${campaignsPath(worldSlug)}?created=1`);
}

export async function renameCampaignAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = readWorldSlug(formData);
  await requireStudioWorldEdit(worldSlug);

  try {
    await campaigns().rename({
      worldSlug,
      campaignId: String(formData.get("campaignId") || ""),
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
    });
  } catch (error) {
    backWithError(worldSlug, error);
  }

  revalidateWorld(worldSlug);
  redirect(`${campaignsPath(worldSlug)}?saved=1`);
}

export async function deleteCampaignAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = readWorldSlug(formData);
  await requireStudioWorldEdit(worldSlug);

  try {
    await campaigns().remove({
      worldSlug,
      campaignId: String(formData.get("campaignId") || ""),
      expectedName: String(formData.get("expectedName") || ""),
    });
  } catch (error) {
    backWithError(worldSlug, error);
  }

  revalidateWorld(worldSlug);
  redirect(`${campaignsPath(worldSlug)}?deleted=1`);
}
