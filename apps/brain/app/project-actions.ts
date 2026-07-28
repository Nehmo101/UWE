"use server";

import {
  parseLinksFromForm,
  type PersonalProjectCategory,
  type PersonalProjectStatus,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { lifeAdmin, revalidateBrainPaths, str } from "@/src/lib/brain-action-shared";
import { requireBrainActionAuth } from "@/src/lib/brain-action-auth";

/**
 * Persönliche Projekte — Abschnitt H4, Brain gewinnt.
 *
 * Voller Feldsatz wie in der Studio-Fassung: Notizen, Links, Kosten und ein
 * Datum für den nächsten Schritt. Was hier fehlt, ist die Welt-Zuordnung —
 * Welten sind Studio-Sache, und ein privates Projekt braucht keine.
 */

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  const raw = str(value);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Euro-Eingabe ("9,99" oder "9.99") in Cents. */
function parseEuroToCents(value: FormDataEntryValue | null): number | null {
  const raw = str(value).replace(",", ".");
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  const raw = str(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function createProjectAction(formData: FormData) {
  await requireBrainActionAuth();
  const name = str(formData.get("name"));
  if (!name) return;

  await lifeAdmin().createPersonalProject({
    name,
    description: str(formData.get("description")),
    status: (str(formData.get("status")) || "idea") as PersonalProjectStatus,
    category: (str(formData.get("category")) || "other") as PersonalProjectCategory,
    nextAction: str(formData.get("nextAction")) || null,
    nextActionDate: parseOptionalDate(formData.get("nextActionDate")),
    notes: str(formData.get("notes")),
    links: parseLinksFromForm(str(formData.get("links"))),
    costCents: parseEuroToCents(formData.get("cost")) ?? parseOptionalInt(formData.get("costCents")),
  });
  revalidateBrainPaths();
}

export async function updateProjectAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;

  await lifeAdmin().updatePersonalProject(id, {
    name: str(formData.get("name")),
    description: str(formData.get("description")),
    status: str(formData.get("status")) as PersonalProjectStatus,
    category: str(formData.get("category")) as PersonalProjectCategory,
    nextAction: str(formData.get("nextAction")) || null,
    nextActionDate: parseOptionalDate(formData.get("nextActionDate")),
    notes: str(formData.get("notes")),
    links: parseLinksFromForm(str(formData.get("links"))),
    costCents: parseEuroToCents(formData.get("cost")) ?? parseOptionalInt(formData.get("costCents")),
  });
  revalidateBrainPaths();
  revalidatePath(`/projects/${id}`);
}

/** Statuswechsel per Ein-Klick-Formular, ohne das ganze Projekt neu zu schreiben. */
export async function updateProjectStatusAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  const status = str(formData.get("status")) as PersonalProjectStatus;
  if (!id || !status) return;

  await lifeAdmin().updatePersonalProject(id, { status });
  revalidateBrainPaths();
  revalidatePath(`/projects/${id}`);
}

export async function deleteProjectAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deletePersonalProject(id);
  revalidateBrainPaths();
}

export async function addProjectStepAction(formData: FormData) {
  await requireBrainActionAuth();
  const projectId = str(formData.get("projectId"));
  const title = str(formData.get("title"));
  if (projectId && title) await lifeAdmin().addProjectStep(projectId, title);
  revalidateBrainPaths();
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function toggleProjectStepAction(formData: FormData) {
  await requireBrainActionAuth();
  const stepId = str(formData.get("stepId"));
  const done = str(formData.get("done")) === "true";
  if (stepId) await lifeAdmin().setProjectStepDone(stepId, done);
  revalidateBrainPaths();
  const projectId = str(formData.get("projectId"));
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectStepAction(formData: FormData) {
  await requireBrainActionAuth();
  const stepId = str(formData.get("stepId"));
  if (stepId) await lifeAdmin().deleteProjectStep(stepId);
  revalidateBrainPaths();
  const projectId = str(formData.get("projectId"));
  if (projectId) revalidatePath(`/projects/${projectId}`);
}
