"use server";

import {
  createLabelService,
  getAppRepository,
  type LabelLayoutMode,
  type LabelSourceType,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function labels() {
  return createLabelService();
}

function repo() {
  return getAppRepository();
}

function parseLayoutMode(value: FormDataEntryValue | null): LabelLayoutMode {
  const mode = String(value || "image_text");
  if (mode === "text_only" || mode === "image_only" || mode === "image_text") {
    return mode;
  }
  return "image_text";
}

export async function createLabelFromSourceAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const campaignSlug = String(formData.get("campaignSlug") || "");
  const campaign = campaignSlug
    ? await repo().getCampaignBySlug(worldSlug, campaignSlug)
    : null;

  const includeDmOnly = formData.get("includeDmOnly") === "on";
  const sourceRef = String(formData.get("sourceRef") || "");
  const colonIdx = sourceRef.indexOf(":");
  const sourceTypeRaw = colonIdx >= 0 ? sourceRef.slice(0, colonIdx) : "";
  const sourceId = colonIdx >= 0 ? sourceRef.slice(colonIdx + 1) : "";

  const sourceType = sourceTypeRaw as LabelSourceType;
  if (!sourceId || !sourceType) {
    throw new Error("Quelle auswählen");
  }

  const label = await labels().createFromSource({
    worldId: world.id,
    campaignId: campaign?.id ?? null,
    sourceType,
    sourceId,
    templateId: String(formData.get("templateId")),
    title: String(formData.get("title") || "") || undefined,
    includeDmOnly,
    layoutSettings: {
      mode: parseLayoutMode(formData.get("layoutMode")),
      truncateToPage: formData.get("truncateToPage") === "on",
      truncateLongWords: formData.get("truncateLongWords") === "on",
    },
  });

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels/${label.id}?created=1`);
}

export async function createManualLabelAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const template = await labels().getTemplateById(String(formData.get("templateId")));
  if (!template) throw new Error("Template not found");

  const label = await labels().createLabel({
    worldId: world.id,
    title: String(formData.get("title") || "Neues Label"),
    sourceType: "manual",
    templateId: template.id,
    content: {
      title: String(formData.get("title") || "Neues Label"),
      text: String(formData.get("text") || ""),
    },
    layoutSettings: {
      mode: parseLayoutMode(formData.get("layoutMode")),
      truncateToPage: formData.get("truncateToPage") === "on",
      truncateLongWords: formData.get("truncateLongWords") === "on",
      widthInches: 6,
      heightInches: 4,
    },
  });

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels/${label.id}?created=1`);
}

export async function updateLabelAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const labelId = String(formData.get("labelId"));

  const existing = await labels().getLabelById(labelId);
  if (!existing) throw new Error("Label not found");

  await labels().updateLabel(labelId, {
    title: String(formData.get("title")),
    templateId: String(formData.get("templateId") || existing.templateId),
    content: {
      title: String(formData.get("contentTitle") || formData.get("title")),
      text: String(formData.get("text") || ""),
    },
    layoutSettings: {
      mode: parseLayoutMode(formData.get("layoutMode")),
      truncateToPage: formData.get("truncateToPage") === "on",
      truncateLongWords: formData.get("truncateLongWords") === "on",
      widthInches: 6,
      heightInches: 4,
    },
  });

  revalidatePath(`/worlds/${worldSlug}/labels`);
  revalidatePath(`/worlds/${worldSlug}/labels/${labelId}`);
  redirect(`/worlds/${worldSlug}/labels/${labelId}?saved=1`);
}

export async function duplicateLabelAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const labelId = String(formData.get("labelId"));

  const copy = await labels().duplicateLabel(labelId);

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels/${copy.id}?duplicated=1`);
}

export async function deleteLabelAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const labelId = String(formData.get("labelId"));

  await labels().deleteLabel(labelId);

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels?deleted=1`);
}
