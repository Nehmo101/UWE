"use server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";

import {
  createSoundboardService,
  getAppRepository,
  type SoundSourceType,
} from "@uwe/database/server";
import { assertValidSoundboardButton } from "@uwe/soundboard";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudioContentEdit, requireStudioWorldEdit } from "@/src/lib/authz";

function soundboard() {
  return createSoundboardService();
}

function repo() {
  return getAppRepository();
}

/** Supports both multi-select fields and comma-separated text input. */
function parseLinkedPageIds(formData: FormData): string[] {
  return formData
    .getAll("linkedPageIds")
    .flatMap((value) => String(value).split(","))
    .map((id) => id.trim())
    .filter(Boolean);
}

function redirectWithError(path: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function parseButtonInput(formData: FormData) {
  const sourceType = String(formData.get("sourceType")) as SoundSourceType;
  const assetId = String(formData.get("assetId") || "") || null;
  const sourceUrl = String(formData.get("sourceUrl") || "") || null;
  const thumbnail = String(formData.get("thumbnail") || "") || null;
  const title = String(formData.get("title") ?? "");
  const volume = Number(formData.get("volume") ?? 1);

  return {
    title,
    sourceType,
    sourceUrl,
    assetId: sourceType === "local" ? assetId : null,
    thumbnail,
    volume,
    loop: formData.get("loop") === "on",
    tags: String(formData.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    linkedPageIds: parseLinkedPageIds(formData),
  };
}

export async function createSoundboardButtonAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const campaignSlug = String(formData.get("campaignSlug") || "");
  const campaign = campaignSlug
    ? await repo().getCampaignBySlug(worldSlug, campaignSlug)
    : null;

  const input = parseButtonInput(formData);
  const redirectParams = new URLSearchParams();
  if (campaignSlug) {
    redirectParams.set("campaign", campaignSlug);
  }
  const redirectPath = `/worlds/${worldSlug}/soundboard${
    redirectParams.size > 0 ? `?${redirectParams.toString()}` : ""
  }`;

  try {
    assertValidSoundboardButton(input);
  } catch (error) {
    redirectWithError(redirectPath, error);
  }

  const sortOrder = await soundboard().getNextSortOrder(world.id, campaign?.id ?? null);

  await soundboard().create({
    worldId: world.id,
    campaignId: campaign?.id ?? null,
    title: input.title,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    assetId: input.assetId,
    thumbnail: input.thumbnail,
    volume: input.volume,
    loop: input.loop,
    tags: input.tags,
    sortOrder,
    linkedPageIds: input.linkedPageIds,
  });

  revalidatePath(`/worlds/${worldSlug}/soundboard`);
  redirectParams.set("created", "1");
  redirect(`/worlds/${worldSlug}/soundboard?${redirectParams.toString()}`);
}

export async function updateSoundboardButtonAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const buttonId = String(formData.get("buttonId"));
  await requireStudioWorldEdit(worldSlug);

  const input = parseButtonInput(formData);
  const redirectPath = `/worlds/${worldSlug}/soundboard`;

  try {
    assertValidSoundboardButton(input);
  } catch (error) {
    redirectWithError(redirectPath, error);
  }

  await soundboard().update(buttonId, {
    title: input.title,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    assetId: input.assetId,
    thumbnail: input.thumbnail,
    volume: input.volume,
    loop: input.loop,
    tags: input.tags,
    linkedPageIds: input.linkedPageIds,
  });

  revalidatePath(`/worlds/${worldSlug}/soundboard`);
  redirect(`${redirectPath}?saved=1`);
}

export async function deleteSoundboardButtonAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const buttonId = String(formData.get("buttonId"));

  await requireStudioWorldEdit(worldSlug);

  await soundboard().delete(buttonId);

  revalidatePath(`/worlds/${worldSlug}/soundboard`);
  redirect(`/worlds/${worldSlug}/soundboard?deleted=1`);
}

export async function linkPageToSoundboardButtonAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const buttonId = String(formData.get("buttonId"));
  const pageId = String(formData.get("pageId"));

  await requireStudioContentEdit(worldSlug, pageId);

  await soundboard().linkPage(buttonId, pageId);

  revalidatePath(`/worlds/${worldSlug}/soundboard`);
  redirect(`/worlds/${worldSlug}/soundboard?linked=1`);
}
