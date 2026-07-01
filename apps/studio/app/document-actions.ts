"use server";

import type { DocumentTemplateCategory } from "@uwe/database/server";
import {
  createDocumentTemplateService,
  DocumentTemplateCategoryEnum,
  prisma,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { assertStudioTrusted } from "@/src/lib/authz";
import { extractTemplateVariables } from "@/src/lib/document-template-utils";

function documentTemplates() {
  return createDocumentTemplateService(prisma);
}

function revalidateDocumentPaths() {
  revalidatePath("/documents");
}

function parseCategory(value: FormDataEntryValue | null): DocumentTemplateCategory {
  const raw = String(value ?? "other");
  if (
    raw === DocumentTemplateCategoryEnum.contract ||
    raw === DocumentTemplateCategoryEnum.guide ||
    raw === DocumentTemplateCategoryEnum.checklist ||
    raw === DocumentTemplateCategoryEnum.other
  ) {
    return raw;
  }
  return DocumentTemplateCategoryEnum.other;
}

export async function createDocumentTemplateAction(formData: FormData) {
  assertStudioTrusted();

  const body = String(formData.get("body") || "");
  await documentTemplates().createTemplate({
    name: String(formData.get("name") || "").trim(),
    category: parseCategory(formData.get("category")),
    body,
    variables: extractTemplateVariables(body),
  });

  revalidateDocumentPaths();
}

export async function updateDocumentTemplateAction(formData: FormData) {
  assertStudioTrusted();

  const id = String(formData.get("id") || "").trim();
  if (!id) {
    throw new Error("Vorlagen-ID fehlt.");
  }

  const body = String(formData.get("body") || "");
  await documentTemplates().updateTemplate(id, {
    name: String(formData.get("name") || "").trim(),
    category: parseCategory(formData.get("category")),
    body,
    variables: extractTemplateVariables(body),
  });

  revalidateDocumentPaths();
}

export async function deleteDocumentTemplateAction(formData: FormData) {
  assertStudioTrusted();

  const id = String(formData.get("id") || "").trim();
  if (!id) {
    throw new Error("Vorlagen-ID fehlt.");
  }

  await documentTemplates().deleteTemplate(id);
  revalidateDocumentPaths();
}
