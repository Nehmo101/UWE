"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import type { CaptureType } from "@uwe/database/server";
import {
  createCaptureTriageService,
  createLifeAdminService,
  prisma,
  type CaptureTriageAction,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { enqueueAndDispatch } from "@/src/lib/job-executor";

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
  "voice_memo",
]);

function lifeAdmin() {
  return createLifeAdminService(prisma);
}

function triageService() {
  return createCaptureTriageService(prisma);
}

function revalidateCapturePaths() {
  revalidatePath("/today");
  revalidatePath("/capture");
}

function parseMetadataJson(raw: string | null): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export async function createCaptureAction(formData: FormData) {
  await requireStudioActionAuth();

  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const captureTypeRaw = String(formData.get("captureType") || "quick_note");
  const url = String(formData.get("url") || "").trim() || null;
  const storageKey = String(formData.get("storageKey") || "").trim() || null;
  const captureIntent = String(formData.get("captureIntent") || "").trim();
  const captureType = VALID_CAPTURE_TYPES.has(captureTypeRaw as CaptureType)
    ? (captureTypeRaw as CaptureType)
    : "quick_note";

  const metadata: Record<string, unknown> = {};
  if (captureIntent) metadata.captureIntent = captureIntent;
  const extraMetadata = parseMetadataJson(String(formData.get("metadataJson") || ""));
  if (extraMetadata) Object.assign(metadata, extraMetadata);

  const originalFilename =
    typeof metadata.originalFilename === "string" ? metadata.originalFilename.trim() : null;

  const requiresContent =
    captureType !== "file_image" && captureType !== "voice_memo" && captureType !== "link";
  if (requiresContent && !content && !title) {
    throw new Error("Inhalt oder Titel erforderlich.");
  }
  if (captureType === "link" && !url) {
    throw new Error("Link-URL erforderlich.");
  }
  if (captureType === "file_image" && !storageKey) {
    throw new Error("Datei-Upload erforderlich.");
  }
  if (captureType === "voice_memo" && !storageKey) {
    throw new Error("Sprachmemo-Upload erforderlich.");
  }

  const capture = await lifeAdmin().createCapture({
    title: title || content.slice(0, 80) || originalFilename || url?.slice(0, 80) || "Capture",
    content,
    captureType,
    url,
    storageKey,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  });

  await triageService().ensureAiProposal(capture.id);

  revalidateCapturePaths();

  const returnTo = String(formData.get("returnTo") || "").trim();
  if (
    returnTo &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    returnTo !== "/capture"
  ) {
    redirect(returnTo);
  }
  redirect(`/capture/${capture.id}`);
}

export async function updateCaptureStatusAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "inbox" | "triaged" | "linked" | "archived";

  await lifeAdmin().updateCapture(id, { status });

  revalidateCapturePaths();
}

export async function deleteCaptureAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  await lifeAdmin().deleteCapture(id);
  revalidateCapturePaths();
  redirect("/capture");
}

export async function generateCaptureProposalAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  const useMock = process.env.AI_USE_MOCK === "true";

  if (useMock) {
    await triageService().ensureAiProposal(id);
  } else {
    await triageService().ensureAiProposal(id);
    await enqueueAndDispatch({
      type: "ai_run",
      title: "Capture Triage Vorschlag",
      payload: {
        captureTriageProposal: true,
        captureId: id,
        useMock: false,
      },
      relatedType: "capture",
      relatedId: id,
    });
  }

  revalidateCapturePaths();

  const returnTo = String(formData.get("returnTo") || `/capture/${id}`);
  redirect(returnTo);
}

export async function reviewCaptureProposalAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "accepted" | "rejected";
  await triageService().updateAiProposalStatus(id, status);
  revalidateCapturePaths();

  const returnTo = String(formData.get("returnTo") || `/capture/${id}`);
  redirect(returnTo);
}

export async function triageCaptureAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  const action = String(formData.get("action")) as CaptureTriageAction;
  const worldId = String(formData.get("worldId") || "").trim() || null;
  const pageId = String(formData.get("pageId") || "").trim() || null;
  const hardwareDeviceId = String(formData.get("hardwareDeviceId") || "").trim() || null;
  const workshopProjectTypeRaw = String(formData.get("workshopProjectType") || "").trim();
  const projectCategoryRaw = String(formData.get("projectCategory") || "").trim();
  const lifeBrainAsDocument = formData.get("lifeBrainAsDocument") === "on";

  const result = await triageService().executeTriage(id, action, {
    worldId,
    pageId,
    hardwareDeviceId,
    workshopProjectType: workshopProjectTypeRaw
      ? (workshopProjectTypeRaw as "dnd_terrain" | "miniature" | "printing_3d" | "diorama" | "artwork" | "other")
      : undefined,
    projectCategory: projectCategoryRaw
      ? (projectCategoryRaw as "uwe" | "hardware_homelab" | "dnd" | "art_workshop" | "printing_3d" | "other")
      : undefined,
    lifeBrainAsDocument: lifeBrainAsDocument || undefined,
  });

  revalidateCapturePaths();
  revalidatePath("/projects");
  revalidatePath("/workshop");
  revalidatePath("/contracts");
  revalidatePath("/hardware");
  revalidatePath("/life-brain");

  const returnTo = String(formData.get("returnTo") || "").trim();
  redirect(returnTo || result.redirectPath);
}
