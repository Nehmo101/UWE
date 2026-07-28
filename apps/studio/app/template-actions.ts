"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  createPageTemplateService,
  prisma,
  type ContentBlockType,
  type PageType,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function templateService() {
  return createPageTemplateService(prisma);
}

/**
 * Parse template blocks from the repeating form fields
 */
function blocksFromFormData(formData: FormData) {
  const blocks: Array<{ type: ContentBlockType; content: string }> = [];

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
  await requireStudioActionAuth();

  let templateId: string;
  try {
    const template = await templateService().createTemplate({
      name: String(formData.get("name") || "").trim(),
      description: String(formData.get("description") || ""),
      pageType: String(formData.get("pageType")) as PageType,
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
  await requireStudioActionAuth();

  const templateId = String(formData.get("templateId"));
  try {
    await templateService().updateTemplate(templateId, {
      name: String(formData.get("name") || "").trim(),
      description: String(formData.get("description") || ""),
      pageType: String(formData.get("pageType")) as PageType,
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
  await requireStudioActionAuth();

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
  await requireStudioActionAuth();

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
