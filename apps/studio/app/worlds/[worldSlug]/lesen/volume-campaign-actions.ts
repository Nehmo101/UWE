"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createCampaignService, CampaignServiceError } from "@uwe/database/campaign";
import { prisma } from "@uwe/database/server";

import { requireStudioWorldEdit } from "@/src/lib/authz";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";

/**
 * Aus einem Band eine Kampagne machen — und Dungeons dazuhängen.
 *
 * Nach einem Dokument-Import liegt ein Kampagnenbuch als Seitenbaum in der Welt.
 * Es gehört dann zu keiner Kampagne oder zu der Sammelkampagne, unter der schon
 * alles andere liegt. Beides ist unbrauchbar: Das Kampagnen-Cockpit zeigt dann
 * entweder nichts oder alles.
 *
 * Die Fachlogik sitzt im Service `@uwe/database/campaign`; hier bleiben Guard,
 * Formular-Parsing und der Rücksprung.
 */

function lesenPath(worldSlug: string) {
  return `/worlds/${worldSlug}/lesen`;
}

function backWithError(worldSlug: string, error: unknown): never {
  if (error instanceof CampaignServiceError) {
    redirect(`${lesenPath(worldSlug)}?fehler=${encodeURIComponent(error.message)}`);
  }
  throw error;
}

function readWorldSlug(formData: FormData): string {
  const worldSlug = String(formData.get("worldSlug") || "").trim();
  if (!worldSlug) throw new Error("Welt fehlt.");
  return worldSlug;
}

/** „Kampagne daraus machen" an einem Band im Lesen-Bereich. */
export async function createCampaignFromVolumeAction(formData: FormData): Promise<void> {
  const worldSlug = readWorldSlug(formData);
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const volumePageId = String(formData.get("volumePageId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  // Mehrere Kästchen mit demselben Namen kommen als mehrere Einträge zurück.
  const dungeonPageIds = formData
    .getAll("dungeonPageIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  let result: { slug: string; assigned: number; dungeonsAttached: number };
  try {
    result = await createCampaignService(prisma).createFromVolume({
      worldSlug,
      volumePageId,
      name: name || undefined,
      dungeonPageIds,
    });
  } catch (error) {
    backWithError(worldSlug, error);
  }

  revalidatePath(lesenPath(worldSlug));
  revalidatePath(`/worlds/${worldSlug}/kampagnen`);
  revalidatePath(`/worlds/${worldSlug}`, "layout");

  const meldung =
    `„${name || "Der Band"}" ist jetzt eine Kampagne: ${result.assigned} Seiten zugeordnet` +
    (result.dungeonsAttached > 0
      ? `, davon ${result.dungeonsAttached === 1 ? "ein Dungeon" : `${result.dungeonsAttached} Dungeons`}.`
      : ".");
  redirect(`/worlds/${worldSlug}/kampagnen?hinweis=${encodeURIComponent(meldung)}`);
}

/** „Dieser Kampagne zuschlagen" — für einen Dungeon-Band, der später dazukommt. */
export async function attachVolumeToCampaignAction(formData: FormData): Promise<void> {
  const worldSlug = readWorldSlug(formData);
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const volumePageId = String(formData.get("volumePageId") || "").trim();
  const campaignId = String(formData.get("campaignId") || "").trim();
  if (!campaignId) {
    redirect(`${lesenPath(worldSlug)}?fehler=${encodeURIComponent("Bitte eine Kampagne auswählen.")}`);
  }

  let assigned = 0;
  try {
    ({ assigned } = await createCampaignService(prisma).attachVolume({
      worldSlug,
      campaignId,
      volumePageId,
    }));
  } catch (error) {
    backWithError(worldSlug, error);
  }

  revalidatePath(lesenPath(worldSlug));
  revalidatePath(`/worlds/${worldSlug}/kampagnen`);
  revalidatePath(`/worlds/${worldSlug}`, "layout");

  redirect(
    `${lesenPath(worldSlug)}?hinweis=${encodeURIComponent(`${assigned} Seiten der Kampagne zugeordnet.`)}`,
  );
}
