"use server";

import {
  createSoundboardService,
  getAppRepository,
  type SoundSourceType,
  type Visibility,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function soundboard() {
  return createSoundboardService();
}

function repo() {
  return getAppRepository();
}

export async function createSoundboardButtonAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const campaignSlug = String(formData.get("campaignSlug") || "");
  const campaign = campaignSlug
    ? await repo().getCampaignBySlug(worldSlug, campaignSlug)
    : null;

  const sourceType = String(formData.get("sourceType")) as SoundSourceType;
  const assetId = String(formData.get("assetId") || "") || null;
  const sourceUrl = String(formData.get("sourceUrl") || "") || null;
  const thumbnail = String(formData.get("thumbnail") || "") || null;

  const linkedPageIds = String(formData.get("linkedPageIds") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const tags = String(formData.get("tags") || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const sortOrder = await soundboard().getNextSortOrder(world.id, campaign?.id ?? null);

  await soundboard().create({
    worldId: world.id,
    campaignId: campaign?.id ?? null,
    title: String(formData.get("title")),
    sourceType,
    sourceUrl,
    assetId: sourceType === "local" ? assetId : null,
    thumbnail,
    volume: Number(formData.get("volume") ?? 1),
    loop: formData.get("loop") === "on",
    tags,
    visibility: (formData.get("visibility") as Visibility) ?? "dm_only",
    sortOrder,
    linkedPageIds,
  });

  revalidatePath(`/worlds/${worldSlug}/soundboard`);
  redirect(`/worlds/${worldSlug}/soundboard?created=1`);
}

export async function updateSoundboardButtonAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const buttonId = String(formData.get("buttonId"));

  const sourceType = String(formData.get("sourceType")) as SoundSourceType;
  const assetId = String(formData.get("assetId") || "") || null;
  const sourceUrl = String(formData.get("sourceUrl") || "") || null;
  const thumbnail = String(formData.get("thumbnail") || "") || null;

  const linkedPageIds = String(formData.get("linkedPageIds") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const tags = String(formData.get("tags") || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  await soundboard().update(buttonId, {
    title: String(formData.get("title")),
    sourceType,
    sourceUrl,
    assetId: sourceType === "local" ? assetId : null,
    thumbnail,
    volume: Number(formData.get("volume") ?? 1),
    loop: formData.get("loop") === "on",
    tags,
    visibility: formData.get("visibility") as Visibility,
    linkedPageIds,
  });

  revalidatePath(`/worlds/${worldSlug}/soundboard`);
  redirect(`/worlds/${worldSlug}/soundboard?saved=1`);
}

export async function deleteSoundboardButtonAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const buttonId = String(formData.get("buttonId"));

  await soundboard().delete(buttonId);

  revalidatePath(`/worlds/${worldSlug}/soundboard`);
  redirect(`/worlds/${worldSlug}/soundboard?deleted=1`);
}

export async function linkPageToSoundboardButtonAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const buttonId = String(formData.get("buttonId"));
  const pageId = String(formData.get("pageId"));

  await soundboard().linkPage(buttonId, pageId);

  revalidatePath(`/worlds/${worldSlug}/soundboard`);
  redirect(`/worlds/${worldSlug}/soundboard?linked=1`);
}
