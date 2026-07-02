"use server";

import type { DocumentTemplateCategory } from "@uwe/database/server";
import {
  createDocumentTemplateService,
  DocumentTemplateCategoryEnum,
  MissingTemplateVariablesError,
  prisma,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { assertStudioTrusted } from "@/src/lib/authz";
import {
  extractTemplateVariables,
  type GenerateDocumentActionResult,
} from "@/src/lib/document-template-utils";

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

/**
 * Generier-Workflow: Platzhalter-Werte in die Vorlage einsetzen und das
 * fertige Dokument als Life-Brain-Dokument speichern (bestehender
 * Speicher-Pfad, sichtbar unter /life-brain/documents/[id]).
 */
export async function generateDocumentFromTemplateAction(input: {
  templateId: string;
  title?: string;
  values: Record<string, string>;
}): Promise<GenerateDocumentActionResult> {
  assertStudioTrusted();

  const templateId = input.templateId?.trim();
  if (!templateId) {
    return { ok: false, error: "Vorlagen-ID fehlt." };
  }

  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.values ?? {})) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }

  try {
    const document = await documentTemplates().generateDocument(templateId, values, {
      title: input.title,
    });

    revalidateDocumentPaths();
    revalidatePath("/life-brain");

    return { ok: true, documentId: document.id, title: document.title };
  } catch (error) {
    if (error instanceof MissingTemplateVariablesError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Dokument konnte nicht erstellt werden.",
    };
  }
}
