"use server";

import {
  createCaptureTriageService,
  prisma,
  type CaptureStatus,
  type CaptureTriageAction,
  type CaptureType,
} from "@uwe/database/server";
import { redirect } from "next/navigation";
import { lifeAdmin, revalidateBrainPaths, str } from "@/src/lib/brain-action-shared";
import { requireBrainActionAuth } from "@/src/lib/brain-action-auth";

/**
 * Capture-Inbox — erfassen, sortieren, einsortieren.
 *
 * Die Seite gab es doppelt (Abschnitt H3); Brain gewinnt. Die Triage-Maschine
 * selbst liegt in `@uwe/database` (`CaptureTriageService`) — hier stehen nur die
 * Form-Adapter, damit die Logik nicht zum zweiten Mal existiert.
 */

function triage() {
  return createCaptureTriageService(prisma);
}

export async function createCaptureAction(formData: FormData) {
  await requireBrainActionAuth();

  const title = str(formData.get("title"));
  const content = str(formData.get("content"));
  const url = str(formData.get("url")) || null;
  const captureType = (str(formData.get("captureType")) || "quick_note") as CaptureType;

  if (!title && !content && !url) return;
  if (captureType === "link" && !url) {
    throw new Error("Link-URL erforderlich.");
  }

  const capture = await lifeAdmin().createCapture({
    title: title || content.slice(0, 80) || url?.slice(0, 80) || "Capture",
    content,
    captureType,
    url,
  });

  // Der KI-Vorschlag entsteht sofort; ohne Maschinenraum fällt er auf die Heuristik zurück.
  await triage().ensureAiProposal(capture.id);
  revalidateBrainPaths();
}

export async function updateCaptureAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;

  await lifeAdmin().updateCapture(id, {
    title: str(formData.get("title")),
    content: str(formData.get("content")),
    captureType: (str(formData.get("captureType")) || "quick_note") as CaptureType,
    status: (str(formData.get("status")) || "inbox") as CaptureStatus,
  });
  revalidateBrainPaths();
}

export async function deleteCaptureAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deleteCapture(id);
  revalidateBrainPaths();
}

export async function updateCaptureStatusAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  const status = str(formData.get("status")) as CaptureStatus;
  if (id && status) await lifeAdmin().updateCapture(id, { status });
  revalidateBrainPaths();
}

/** Archiviert alles, was noch in der Inbox liegt. */
export async function bulkArchiveCapturesAction() {
  await requireBrainActionAuth();
  const service = lifeAdmin();
  const captures = await service.listCaptures({ status: "inbox", limit: 500 });
  for (const capture of captures) {
    await service.updateCapture(capture.id, { status: "archived" });
  }
  revalidateBrainPaths();
}

/**
 * Stellt sicher, dass ein KI-Vorschlag existiert.
 *
 * Heuristik, nicht Maschinenraum: die Job-Queue läuft im Studio-Prozess, und ein
 * Sortiervorschlag ist keinen zweiten Queue-Pfad wert.
 */
export async function generateCaptureProposalAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await triage().ensureAiProposal(id);
  revalidateBrainPaths();
}

export async function triageCaptureAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  const action = str(formData.get("action")) as CaptureTriageAction;
  if (!id || !action) return;

  const result = await triage().executeTriage(id, action, {
    hardwareDeviceId: str(formData.get("hardwareDeviceId")) || null,
    lifeBrainAsDocument: formData.get("lifeBrainAsDocument") === "on" || undefined,
  });

  revalidateBrainPaths();

  // Brain und Studio teilen die Pfadnamen (/projects, /workshop, /hardware,
  // /life-brain), der Redirect des Service passt deshalb unverändert — außer
  // wenn er auf eine Studio-eigene Fläche zeigt.
  const target = result.redirectPath;
  if (target && target.startsWith("/") && !target.startsWith("/worlds")) {
    redirect(target);
  }
}
