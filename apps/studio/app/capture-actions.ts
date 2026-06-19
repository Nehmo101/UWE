"use server";

import type { CaptureStatus, CaptureType } from "@uwe/database/server";
import {
  createLifeAdminService,
  getSystemSettings,
  prisma,
  resolveEffectiveUploadsPath,
  saveCaptureUploadFile,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStudioTrusted } from "@/src/lib/authz";

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

const VALID_CAPTURE_STATUSES = new Set<CaptureStatus>([
  "inbox",
  "triaged",
  "linked",
  "archived",
]);

function lifeAdmin() {
  return createLifeAdminService(prisma);
}

function parseCaptureType(raw: string, hasFile: boolean): CaptureType {
  if (hasFile) {
    return "file_image";
  }
  return VALID_CAPTURE_TYPES.has(raw as CaptureType) ? (raw as CaptureType) : "quick_note";
}

export async function createCaptureAction(formData: FormData) {
  assertStudioTrusted();

  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const captureTypeRaw = String(formData.get("captureType") || "quick_note");
  const url = String(formData.get("url") || "").trim() || null;
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  const captureType = parseCaptureType(captureTypeRaw, hasFile);

  let storageKey: string | null = null;
  let metadata: Record<string, unknown> | null = null;

  if (hasFile && file instanceof File) {
    const settings = await getSystemSettings(prisma);
    const uploadsRoot = resolveEffectiveUploadsPath(settings);
    const buffer = Buffer.from(await file.arrayBuffer());
    const validated = saveCaptureUploadFile(buffer, {
      originalFilename: file.name,
      declaredMimeType: file.type,
      uploadsRoot,
      imagesOnly: captureType === "file_image",
    });
    storageKey = validated.storageKey;
    metadata = {
      originalFilename: validated.originalFilename,
      mimeType: validated.mimeType,
      size: validated.size,
      kind: validated.kind,
    };
  }

  if (captureType === "file_image" && !storageKey) {
    throw new Error("file_image Capture requires an image upload.");
  }

  await lifeAdmin().createCapture({
    title: title || content.slice(0, 80) || (hasFile ? "Bild-Capture" : "Capture"),
    content,
    captureType,
    url,
    storageKey,
    metadata,
  });

  revalidatePath("/today");
  revalidatePath("/capture");

  const returnTo = String(formData.get("returnTo") || "/capture");
  redirect(returnTo);
}

export async function updateCaptureStatusAction(formData: FormData) {
  assertStudioTrusted();

  const id = String(formData.get("id"));
  const statusRaw = String(formData.get("status"));
  if (!VALID_CAPTURE_STATUSES.has(statusRaw as CaptureStatus)) {
    throw new Error("Invalid capture status");
  }

  await lifeAdmin().updateCapture(id, { status: statusRaw as CaptureStatus });

  revalidatePath("/today");
  revalidatePath("/capture");
}

export async function convertCaptureToProjectAction(formData: FormData) {
  assertStudioTrusted();

  const id = String(formData.get("id"));
  await lifeAdmin().convertCaptureToProject(id);

  revalidatePath("/today");
  revalidatePath("/capture");
  revalidatePath("/projects");
  redirect("/projects");
}

export async function convertCaptureToWorkshopAction(formData: FormData) {
  assertStudioTrusted();

  const id = String(formData.get("id"));
  await lifeAdmin().convertCaptureToWorkshop(id);

  revalidatePath("/today");
  revalidatePath("/capture");
  revalidatePath("/workshop");
  redirect("/workshop");
}

export async function deleteCaptureAction(formData: FormData) {
  assertStudioTrusted();

  const id = String(formData.get("id"));
  await lifeAdmin().deleteCapture(id);
  revalidatePath("/today");
  revalidatePath("/capture");
}
