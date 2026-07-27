"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  applyAutoFitToContent,
  createLabelService,
  getAppRepository,
  restoreOriginalText,
  syncContentFromElements,
  type LabelContentData,
  type LabelElement,
  type LabelLayoutMode,
  type LabelPrintStatus,
  type LabelSourceType,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

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

function parseElementsJson(value: FormDataEntryValue | null): LabelElement[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? (parsed as LabelElement[]) : [];
  } catch {
    return [];
  }
}

type ActivityTargetType = "label" | "print_list";

async function logLabelActivity(
  worldSlug: string,
  worldId: string,
  action: "content_created" | "content_updated" | "export_executed",
  targetType: ActivityTargetType,
  targetId: string,
  title: string,
  summary: string,
  targetHref: string,
) {
  try {
    const { createPrismaClient } = await import("@uwe/database/server");
    const db = createPrismaClient();
    await db.activityLog.create({
      data: {
        worldId,
        worldSlug,
        action,
        targetType,
        targetId,
        targetLabel: title,
        targetHref,
        summary,
      },
    });
  } catch {
    // Activity log must not break actions
  }
}

export async function createLabelFromSourceAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const campaignSlug = String(formData.get("campaignSlug") || "");
  const campaign = campaignSlug
    ? await repo().getCampaignBySlug(worldSlug, campaignSlug)
    : null;

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
    layoutSettings: {
      mode: parseLayoutMode(formData.get("layoutMode")),
      truncateToPage: formData.get("truncateToPage") === "on",
      truncateLongWords: formData.get("truncateLongWords") === "on",
    },
  });

  await logLabelActivity(
    worldSlug,
    world.id,
    "content_created",
    "label",
    label.id,
    label.title,
    "Label erstellt",
    `/worlds/${worldSlug}/labels/${label.id}`,
  );

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels/${label.id}?created=1`);
}

export async function createManualLabelAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

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
      editorMode: "visual",
    },
    layoutSettings: {
      mode: parseLayoutMode(formData.get("layoutMode")),
      truncateToPage: formData.get("truncateToPage") === "on",
      truncateLongWords: formData.get("truncateLongWords") === "on",
      widthInches: 6,
      heightInches: 4,
    },
  });

  await logLabelActivity(
    worldSlug,
    world.id,
    "content_created",
    "label",
    label.id,
    label.title,
    "Manuelles Label erstellt",
    `/worlds/${worldSlug}/labels/${label.id}`,
  );

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels/${label.id}?created=1`);
}

export async function updateLabelAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const labelId = String(formData.get("labelId"));
  const action = String(formData.get("action") || "save");

  await requireStudioWorldEdit(worldSlug);

  const existing = await labels().getLabelById(labelId);
  if (!existing) throw new Error("Label not found");

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const elements = parseElementsJson(formData.get("elementsJson"));
  let content: LabelContentData = {
    title: String(formData.get("contentTitle") || formData.get("title")),
    text: String(formData.get("text") || ""),
    originalText: String(formData.get("originalText") || formData.get("text") || ""),
    editorMode: "visual",
    elements,
    imageAssetId: existing.content
      ? (existing.content as { imageAssetId?: string }).imageAssetId
      : null,
  };

  if (elements.length > 0) {
    content = syncContentFromElements(content, elements);
  }

  const layoutSettings = {
    mode: parseLayoutMode(formData.get("layoutMode")),
    truncateToPage: formData.get("truncateToPage") === "on",
    truncateLongWords: formData.get("truncateLongWords") === "on",
    widthInches: 6,
    heightInches: 4,
    snapToGrid: formData.get("snapToGrid") === "on",
    showSafeArea: formData.get("showSafeArea") === "on",
    showCropMarks: formData.get("showCropMarks") === "on",
    fitMode: (String(formData.get("fitMode") || "normal") as "conservative" | "normal" | "aggressive"),
  };

  if (action === "auto_fit") {
    content = applyAutoFitToContent(content, layoutSettings, elements);
  } else if (action === "restore_original") {
    content = restoreOriginalText(content);
  } else if (action === "ai_shorten") {
    const sourceText = content.originalText || content.text || "";
    const actor = await getCurrentAuthUser();
    const { tryAiShortenLabelText } = await import("@/src/lib/label-ai-shorten");
    const shortened = await tryAiShortenLabelText(sourceText, {
      userId: actor?.id,
    });
    if (shortened) {
      content = {
        ...content,
        text: shortened,
        fitApplied: true,
        fitStatus: "tight",
      };
      if (elements.length > 0) {
        content = syncContentFromElements(content, elements.map((el) =>
          el.type === "text" || el.type === "title"
            ? { ...el, text: shortened }
            : el,
        ));
      }
    } else {
      content = applyAutoFitToContent(content, layoutSettings, elements);
    }
  }

  await labels().updateLabel(labelId, {
    title: String(formData.get("title")),
    templateId: String(formData.get("templateId") || existing.templateId),
    content,
    layoutSettings,
  });

  await logLabelActivity(
    worldSlug,
    world.id,
    "content_updated",
    "label",
    labelId,
    String(formData.get("title")),
    action === "ai_shorten" ? "Label per KI gekürzt" : "Label geändert",
    `/worlds/${worldSlug}/labels/${labelId}`,
  );

  revalidatePath(`/worlds/${worldSlug}/labels`);
  revalidatePath(`/worlds/${worldSlug}/labels/${labelId}`);
  redirect(`/worlds/${worldSlug}/labels/${labelId}?saved=1`);
}

export async function duplicateLabelAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const labelId = String(formData.get("labelId"));

  await requireStudioWorldEdit(worldSlug);

  const copy = await labels().duplicateLabel(labelId);

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels/${copy.id}?duplicated=1`);
}

export async function deleteLabelAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const labelId = String(formData.get("labelId"));

  await requireStudioWorldEdit(worldSlug);

  await labels().deleteLabel(labelId);

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels?deleted=1`);
}

export async function saveLabelAsTemplateAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const labelId = String(formData.get("labelId"));
  const name = String(formData.get("templateName") || "Mein Template");

  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const template = await labels().saveAsTemplate(labelId, name, world.id);

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels?tab=templates&templateSaved=${template.id}`);
}

export async function resetLabelToTemplateAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const labelId = String(formData.get("labelId"));

  await requireStudioWorldEdit(worldSlug);

  await labels().resetLabelToTemplate(labelId);

  revalidatePath(`/worlds/${worldSlug}/labels/${labelId}`);
  redirect(`/worlds/${worldSlug}/labels/${labelId}?reset=1`);
}

export async function duplicateTemplateAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const templateId = String(formData.get("templateId"));

  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  await labels().duplicateTemplate(templateId, world.id);

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels?tab=templates&duplicated=1`);
}

export async function renameTemplateAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const templateId = String(formData.get("templateId"));
  const name = String(formData.get("name"));

  await requireStudioWorldEdit(worldSlug);

  await labels().renameTemplate(templateId, name);

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels?tab=templates&renamed=1`);
}

export async function deleteTemplateAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const templateId = String(formData.get("templateId"));

  await requireStudioWorldEdit(worldSlug);

  await labels().deleteWorldTemplate(templateId);

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels?tab=templates&deleted=1`);
}

export async function logLabelExportActivity(
  worldSlug: string,
  labelId: string,
  title: string,
  format: string,
) {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) return;

  await logLabelActivity(
    worldSlug,
    world.id,
    "export_executed",
    "label",
    labelId,
    title,
    `Label exportiert (${format})`,
    `/worlds/${worldSlug}/labels/${labelId}`,
  );
}

export async function setLabelPrintStatusAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const labelId = String(formData.get("labelId"));
  const status = String(formData.get("status")) as LabelPrintStatus;

  await requireStudioWorldEdit(worldSlug);

  await labels().setPrintStatus(labelId, status);

  revalidatePath(`/worlds/${worldSlug}/labels/${labelId}`);
  redirect(`/worlds/${worldSlug}/labels/${labelId}?status=${status}`);
}
