"use server";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  createLifeAdminService,
  prisma,
  type CaptureType,
  type ContractStatus,
  type HardwareStatus,
  type PersonalProjectCategory,
  type PersonalProjectStatus,
  type WorkshopProjectType,
  type WorkshopStatus,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { requireBrainActionAuth } from "@/src/lib/brain-action-auth";

function lifeAdmin() {
  return createLifeAdminService(brainPrisma, prisma);
}

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function parseCommaTags(formData: FormData, field = "tags"): string[] {
  return str(formData.get(field))
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Euro input ("9,99" or "9.99") → cents; accepts comma as decimal separator. */
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

function revalidateBrainPaths() {
  for (const path of [
    "/",
    "/today",
    "/life-brain",
    "/capture",
    "/projects",
    "/workshop",
    "/contracts",
    "/hardware",
    "/documents",
  ]) {
    revalidatePath(path);
  }
}

/* ── Capture ─────────────────────────────────────────────────────────── */

export async function createCaptureAction(formData: FormData) {
  await requireBrainActionAuth();
  const title = str(formData.get("title"));
  const content = str(formData.get("content"));
  if (!title && !content) return;

  await lifeAdmin().createCapture({
    title,
    content,
    captureType: (str(formData.get("captureType")) || "quick_note") as CaptureType,
    status: "inbox",
  });
  revalidateBrainPaths();
}

export async function deleteCaptureAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deleteCapture(id);
  revalidateBrainPaths();
}

/* ── Personal Brain: facts + documents ───────────────────────────────── */

export async function createBrainFactAction(formData: FormData) {
  await requireBrainActionAuth();
  const title = str(formData.get("title"));
  if (!title) return;

  await lifeAdmin().createPersonalBrainFact({
    title,
    content: str(formData.get("content")),
    factType: str(formData.get("factType")) || "custom",
    tags: parseCommaTags(formData),
  });
  revalidateBrainPaths();
}

export async function deleteBrainFactAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deletePersonalBrainFact(id);
  revalidateBrainPaths();
}

export async function createBrainDocumentAction(formData: FormData) {
  await requireBrainActionAuth();
  const title = str(formData.get("title"));
  if (!title) return;

  await lifeAdmin().createPersonalBrainDocument({
    title,
    content: str(formData.get("content")),
    category: str(formData.get("category")) || null,
    tags: parseCommaTags(formData),
  });
  revalidateBrainPaths();
}

export async function deleteBrainDocumentAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deletePersonalBrainDocument(id);
  revalidateBrainPaths();
}

/* ── Personal Projects (+ steps) ─────────────────────────────────────── */

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
  });
  revalidateBrainPaths();
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
  revalidatePath("/projects");
}

export async function toggleProjectStepAction(formData: FormData) {
  await requireBrainActionAuth();
  const stepId = str(formData.get("stepId"));
  const done = str(formData.get("done")) === "true";
  if (stepId) await lifeAdmin().setProjectStepDone(stepId, done);
  revalidatePath("/projects");
}

export async function deleteProjectStepAction(formData: FormData) {
  await requireBrainActionAuth();
  const stepId = str(formData.get("stepId"));
  if (stepId) await lifeAdmin().deleteProjectStep(stepId);
  revalidatePath("/projects");
}

/* ── Workshop ────────────────────────────────────────────────────────── */

export async function createWorkshopAction(formData: FormData) {
  await requireBrainActionAuth();
  const title = str(formData.get("title"));
  if (!title) return;

  await lifeAdmin().createWorkshopProject({
    title,
    projectType: (str(formData.get("projectType")) || "miniature") as WorkshopProjectType,
    status: (str(formData.get("status")) || "idea") as WorkshopStatus,
    description: str(formData.get("description")),
  });
  revalidateBrainPaths();
}

export async function deleteWorkshopAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deleteWorkshopProject(id);
  revalidateBrainPaths();
}

/* ── Contracts ───────────────────────────────────────────────────────── */

export async function createContractAction(formData: FormData) {
  await requireBrainActionAuth();
  const name = str(formData.get("name"));
  if (!name) return;

  await lifeAdmin().createContractExpense({
    name,
    vendor: str(formData.get("vendor")),
    status: (str(formData.get("status")) || "active") as ContractStatus,
    amountCents: parseEuroToCents(formData.get("amount")),
    nextPaymentDate: parseOptionalDate(formData.get("nextPaymentDate")),
    notes: str(formData.get("notes")),
  });
  revalidateBrainPaths();
}

export async function deleteContractAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deleteContractExpense(id);
  revalidateBrainPaths();
}

/* ── Hardware ────────────────────────────────────────────────────────── */

export async function createHardwareAction(formData: FormData) {
  await requireBrainActionAuth();
  const name = str(formData.get("name"));
  if (!name) return;

  await lifeAdmin().createHardwareDevice({
    name,
    role: str(formData.get("role")),
    status: (str(formData.get("status")) || "active") as HardwareStatus,
    hostname: str(formData.get("hostname")) || null,
    operatingSystem: str(formData.get("operatingSystem")),
  });
  revalidateBrainPaths();
}

export async function deleteHardwareAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deleteHardwareDevice(id);
  revalidateBrainPaths();
}
