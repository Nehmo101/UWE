"use server";

import { mergeHardwareRunbookMetadata, type HardwareStatus } from "@uwe/database/server";
import {
  commaList,
  lifeAdmin,
  lines,
  revalidateBrainPaths,
  str,
} from "@/src/lib/brain-action-shared";
import { requireBrainActionAuth } from "@/src/lib/brain-action-auth";

/**
 * Homelab-Inventar — Geräte, Setup-Schritte, Prüfungen und Fehlerhistorie.
 *
 * Lag doppelt in Studio und Brain (Abschnitt H8). Brain gewinnt; die Actions
 * hier haben denselben Funktionsumfang wie die Studio-Fassung, nur ohne den
 * Studio-Auth-Pfad — Brain ist owner-only, das ist die Bedingung.
 *
 * Eigene Datei statt `brain-actions.ts` zu vergrößern (Modul-Disziplin: neue
 * Dateien unter 700 Zeilen, bestehende nicht weiter aufblähen).
 */

export async function createHardwareAction(formData: FormData) {
  await requireBrainActionAuth();
  const name = str(formData.get("name"));
  if (!name) return;

  await lifeAdmin().createHardwareDevice({
    name,
    role: str(formData.get("role")),
    status: (str(formData.get("status")) || "planned") as HardwareStatus,
    hostname: str(formData.get("hostname")) || null,
    ipAddress: str(formData.get("ipAddress")) || null,
    localUrl: str(formData.get("localUrl")) || null,
    publicUrl: str(formData.get("publicUrl")) || null,
    operatingSystem: str(formData.get("operatingSystem")),
    errorNotes: str(formData.get("errorNotes")) || null,
    notes: str(formData.get("notes")),
    specs: lines(formData.get("specs")),
    metadata: mergeHardwareRunbookMetadata(
      { services: lines(formData.get("services")) },
      str(formData.get("runbook")),
    ),
    setupSteps: lines(formData.get("setupSteps")).map((label) => ({ label, done: false })),
  });
  revalidateBrainPaths();
}

export async function updateHardwareAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;

  const specs = lines(formData.get("specs"));
  const device = await lifeAdmin().getHardwareDevice(id);
  // Metadaten sind ein freies JSON-Feld: erst den Bestand übernehmen, damit ein
  // Formular ohne diese Felder nichts stillschweigend wegwirft.
  const baseMetadata =
    device?.metadata && typeof device.metadata === "object"
      ? { ...(device.metadata as Record<string, unknown>) }
      : {};

  await lifeAdmin().updateHardwareDevice(id, {
    name: str(formData.get("name")),
    role: str(formData.get("role")),
    status: str(formData.get("status")) as HardwareStatus,
    hostname: str(formData.get("hostname")) || null,
    ipAddress: str(formData.get("ipAddress")) || null,
    localUrl: str(formData.get("localUrl")) || null,
    publicUrl: str(formData.get("publicUrl")) || null,
    operatingSystem: str(formData.get("operatingSystem")),
    specs: specs.length > 0 ? specs : null,
    errorNotes: str(formData.get("errorNotes")) || null,
    notes: str(formData.get("notes")),
    metadata: mergeHardwareRunbookMetadata(
      { ...baseMetadata, services: lines(formData.get("services")) },
      str(formData.get("runbook")),
    ),
  });
  revalidateBrainPaths();
}

export async function deleteHardwareAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deleteHardwareDevice(id);
  revalidateBrainPaths();
}

export async function addHardwareErrorAction(formData: FormData) {
  await requireBrainActionAuth();
  const deviceId = str(formData.get("deviceId"));
  const problem = str(formData.get("problem"));
  if (!deviceId || !problem) return;

  const affected = commaList(formData.get("affectedServices"));
  await lifeAdmin().addHardwareErrorEntry(deviceId, {
    problem,
    resolution: str(formData.get("resolution")) || undefined,
    affectedServices: affected.length > 0 ? affected : undefined,
  });
  revalidateBrainPaths();
}

export async function recordHardwareCheckAction(formData: FormData) {
  await requireBrainActionAuth();
  const deviceId = str(formData.get("deviceId"));
  if (deviceId) await lifeAdmin().recordHardwareCheck(deviceId);
  revalidateBrainPaths();
}

export async function toggleHardwareSetupStepAction(formData: FormData) {
  await requireBrainActionAuth();
  const deviceId = str(formData.get("deviceId"));
  const stepIndex = Number.parseInt(str(formData.get("stepIndex")), 10);
  if (deviceId && Number.isFinite(stepIndex)) {
    await lifeAdmin().toggleHardwareSetupStep(deviceId, stepIndex);
  }
  revalidateBrainPaths();
}
