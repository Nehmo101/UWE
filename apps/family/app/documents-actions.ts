"use server";

import {
  createDocumentTemplateService,
  type DocumentTemplateCategory,
} from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import { extractTemplateVariables } from "@uwe/shared-utils";
import { revalidatePath } from "next/cache";
import { requireFamilyActionAuth } from "@/src/lib/family-action-auth";

/**
 * Dokumentvorlagen (H9) — Textbausteine für Kündigungen, Anleitungen,
 * Checklisten.
 *
 * Die Vorlagen sind geteilt; das *ausgefüllte* Dokument wird bewusst nirgends
 * gespeichert. Wer einen Brief schreibt, kopiert den Text und schickt ihn ab —
 * ein weiterer Ablageort wäre eine Sammlung, die niemand pflegt.
 */

function templates() {
  return createDocumentTemplateService(familyPrisma);
}

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function category(value: FormDataEntryValue | null): DocumentTemplateCategory {
  const raw = str(value);
  return raw === "contract" || raw === "guide" || raw === "checklist"
    ? raw
    : "other";
}

function revalidateDocuments(): void {
  revalidatePath("/documents");
}

export async function createTemplateAction(formData: FormData) {
  await requireFamilyActionAuth();
  const name = str(formData.get("name"));
  if (!name) return;

  const body = String(formData.get("body") ?? "");
  await templates().createTemplate({
    name,
    category: category(formData.get("category")),
    body,
    // Die Platzhalterliste wird aus dem Text abgeleitet — so kann sie nicht
    // vom Inhalt abweichen.
    variables: extractTemplateVariables(body),
  });
  revalidateDocuments();
}

export async function updateTemplateAction(formData: FormData) {
  await requireFamilyActionAuth();
  const id = str(formData.get("id"));
  const name = str(formData.get("name"));
  if (!id || !name) return;

  const body = String(formData.get("body") ?? "");
  await templates().updateTemplate(id, {
    name,
    category: category(formData.get("category")),
    body,
    variables: extractTemplateVariables(body),
  });
  revalidateDocuments();
}

export async function deleteTemplateAction(formData: FormData) {
  await requireFamilyActionAuth();
  const id = str(formData.get("id"));
  if (id) await templates().deleteTemplate(id);
  revalidateDocuments();
}
