"use server";

import type { CaptureType } from "@uwe/database/server";
import { createLifeAdminService, prisma } from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const VALID_CAPTURE_TYPES = new Set<CaptureType>([
  "quick_note",
  "dnd_idea",
  "uwe_todo",
  "project_idea",
  "hardware",
  "contract_expense",
  "art_miniature_terrain",
  "link",
  "file_image",
]);

function lifeAdmin() {
  return createLifeAdminService(prisma);
}

export async function createCaptureAction(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const captureTypeRaw = String(formData.get("captureType") || "quick_note");
  const url = String(formData.get("url") || "").trim() || null;
  const captureType = VALID_CAPTURE_TYPES.has(captureTypeRaw as CaptureType)
    ? (captureTypeRaw as CaptureType)
    : "quick_note";

  await lifeAdmin().createCapture({
    title: title || content.slice(0, 80) || "Capture",
    content,
    captureType,
    url,
  });

  revalidatePath("/today");
  revalidatePath("/capture");

  const returnTo = String(formData.get("returnTo") || "/capture");
  redirect(returnTo);
}

export async function updateCaptureStatusAction(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "inbox" | "triaged" | "linked" | "archived";

  await lifeAdmin().updateCapture(id, { status });

  revalidatePath("/today");
  revalidatePath("/capture");
}

export async function deleteCaptureAction(formData: FormData) {
  const id = String(formData.get("id"));
  await lifeAdmin().deleteCapture(id);
  revalidatePath("/today");
  revalidatePath("/capture");
}
