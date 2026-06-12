"use server";

import {
  createPageTemplateService,
  prisma,
  type ContentBlockType,
  type PageType,
  type Visibility,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function templateService() {
  return createPageTemplateService(prisma);
}

/**
 * Parse template blocks from the repeating form fields
 * (blockType_N / blockVisibility_N / blockContent_N / blockRemove_N).
 */
function blocksFromFormData(formData: FormData) {
  const blocks: { type: ContentBlockType; visibility: Visibility; content: string }[] = [];

  for (let index = 0; index < 20; index += 1) {
    const type = formData.get(`blockType_${index}`);
    if (type === null) continue;
    if (formData.get(`blockRemove_${index}`) === "on") continue;

    const isNewRow = formData.get(`blockNew_${index}`) === "1";
    const content = String(formData.get(`blockContent_${index}`) ?? "");
    // The optional empty "add block" row is only used when content was entered.
    if (isNewRow && content.trim() === "") continue;

    blocks.push({
      type: String(type) as ContentBlockType,
      visibility: String(formData.get(`blockVisibility_${index}`) ?? "dm_only") as Visibility,
      content,
    });
  }

  return blocks;
}

function redirectWithError(path: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createTemplateAction(formData: FormData) {
  let templateId: string;
  try {
    const template = await templateService().createTemplate({
      name: String(formData.get("name") || "").trim(),
      description: String(formData.get("description") || ""),
      pageType: String(formData.get("pageType")) as PageType,
      defaultVisibility: String(formData.get("defaultVisibility")) as Visibility,
      titlePlaceholder: String(formData.get("titlePlaceholder") || ""),
      blocks: blocksFromFormData(formData),
    });
    templateId = template.id;
  } catch (error) {
    redirectWithError("/templates/new", error);
  }

  revalidatePath("/templates");
  redirect(`/templates/${templateId}?saved=1`);
}

export async function updateTemplateAction(formData: FormData) {
  const templateId = String(formData.get("templateId"));
  try {
    await templateService().updateTemplate(templateId, {
      name: String(formData.get("name") || "").trim(),
      description: String(formData.get("description") || ""),
      pageType: String(formData.get("pageType")) as PageType,
      defaultVisibility: String(formData.get("defaultVisibility")) as Visibility,
      titlePlaceholder: String(formData.get("titlePlaceholder") || ""),
      blocks: blocksFromFormData(formData),
    });
  } catch (error) {
    redirectWithError(`/templates/${templateId}`, error);
  }

  revalidatePath("/templates");
  revalidatePath(`/templates/${templateId}`);
  redirect(`/templates/${templateId}?saved=1`);
}

export async function duplicateTemplateAction(formData: FormData) {
  const templateId = String(formData.get("templateId"));
  let copyId: string;
  try {
    const copy = await templateService().duplicateTemplate(templateId);
    copyId = copy.id;
  } catch (error) {
    redirectWithError("/templates", error);
  }

  revalidatePath("/templates");
  redirect(`/templates/${copyId}?saved=1`);
}

export async function setTemplateActiveAction(formData: FormData) {
  const templateId = String(formData.get("templateId"));
  const isActive = String(formData.get("isActive")) === "true";
  try {
    await templateService().setTemplateActive(templateId, isActive);
  } catch (error) {
    redirectWithError("/templates", error);
  }

  revalidatePath("/templates");
  revalidatePath(`/templates/${templateId}`);
  redirect("/templates");
}
