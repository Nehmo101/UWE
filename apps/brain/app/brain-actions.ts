"use server";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  createCalendarService,
  createDocumentTemplateService,
  createLifeAdminService,
  createMailAccountService,
  createMiniatureCollectionService,
  prisma,
  type CalendarEventKind,
  type CaptureStatus,
  type CaptureType,
  type ContractStatus,
  type DocumentTemplateCategory,
  type HardwareStatus,
  type MiniatureCollectionStatus,
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

/* ══ Edit (update) actions ═══════════════════════════════════════════ */

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

export async function updateBrainFactAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  await lifeAdmin().updatePersonalBrainFact(id, {
    title: str(formData.get("title")),
    content: str(formData.get("content")),
    factType: str(formData.get("factType")) || "custom",
    tags: parseCommaTags(formData),
  });
  revalidateBrainPaths();
}

export async function updateBrainDocumentAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  await lifeAdmin().updatePersonalBrainDocument(id, {
    title: str(formData.get("title")),
    content: str(formData.get("content")),
    category: str(formData.get("category")) || null,
    tags: parseCommaTags(formData),
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
    status: (str(formData.get("status")) || "idea") as PersonalProjectStatus,
    category: (str(formData.get("category")) || "other") as PersonalProjectCategory,
    nextAction: str(formData.get("nextAction")) || null,
  });
  revalidatePath("/projects");
}

export async function updateWorkshopAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  await lifeAdmin().updateWorkshopProject(id, {
    title: str(formData.get("title")),
    projectType: (str(formData.get("projectType")) || "miniature") as WorkshopProjectType,
    status: (str(formData.get("status")) || "idea") as WorkshopStatus,
    description: str(formData.get("description")),
  });
  revalidateBrainPaths();
}

export async function updateContractAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  await lifeAdmin().updateContractExpense(id, {
    name: str(formData.get("name")),
    vendor: str(formData.get("vendor")),
    status: (str(formData.get("status")) || "active") as ContractStatus,
    amountCents: parseEuroToCents(formData.get("amount")),
    nextPaymentDate: parseOptionalDate(formData.get("nextPaymentDate")),
    notes: str(formData.get("notes")),
  });
  revalidateBrainPaths();
}

export async function updateHardwareAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  await lifeAdmin().updateHardwareDevice(id, {
    name: str(formData.get("name")),
    role: str(formData.get("role")),
    status: (str(formData.get("status")) || "active") as HardwareStatus,
    hostname: str(formData.get("hostname")) || null,
    operatingSystem: str(formData.get("operatingSystem")),
  });
  revalidateBrainPaths();
}

/* ══ Miniatures collection ═══════════════════════════════════════════ */

function miniatures() {
  return createMiniatureCollectionService(brainPrisma);
}

function parseQuantity(value: FormDataEntryValue | null): number {
  const n = Number.parseInt(str(value), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function createMiniatureAction(formData: FormData) {
  await requireBrainActionAuth();
  const name = str(formData.get("name"));
  if (!name) return;
  await miniatures().createItem({
    name,
    manufacturer: str(formData.get("manufacturer")) || null,
    gameSystem: str(formData.get("gameSystem")) || null,
    faction: str(formData.get("faction")) || null,
    quantity: parseQuantity(formData.get("quantity")),
    status: (str(formData.get("status")) || "purchased") as MiniatureCollectionStatus,
    notes: str(formData.get("notes")),
  });
  revalidatePath("/miniatures");
}

export async function updateMiniatureAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  await miniatures().updateItem(id, {
    name: str(formData.get("name")),
    manufacturer: str(formData.get("manufacturer")) || null,
    gameSystem: str(formData.get("gameSystem")) || null,
    faction: str(formData.get("faction")) || null,
    quantity: parseQuantity(formData.get("quantity")),
    status: (str(formData.get("status")) || "purchased") as MiniatureCollectionStatus,
    notes: str(formData.get("notes")),
  });
  revalidatePath("/miniatures");
}

export async function deleteMiniatureAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await miniatures().deleteItem(id);
  revalidatePath("/miniatures");
}

/* ══ Document templates ══════════════════════════════════════════════ */

function templates() {
  return createDocumentTemplateService(brainPrisma);
}

export async function createTemplateAction(formData: FormData) {
  await requireBrainActionAuth();
  const name = str(formData.get("name"));
  if (!name) return;
  await templates().createTemplate({
    name,
    category: (str(formData.get("category")) || "other") as DocumentTemplateCategory,
    body: str(formData.get("body")),
  });
  revalidatePath("/documents");
}

export async function updateTemplateAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  await templates().updateTemplate(id, {
    name: str(formData.get("name")),
    category: (str(formData.get("category")) || "other") as DocumentTemplateCategory,
    body: str(formData.get("body")),
  });
  revalidatePath("/documents");
}

export async function deleteTemplateAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await templates().deleteTemplate(id);
  revalidatePath("/documents");
}

/* ══ Calendar events ═════════════════════════════════════════════════ */

function calendar() {
  return createCalendarService(brainPrisma, prisma);
}

export async function createEventAction(formData: FormData) {
  await requireBrainActionAuth();
  const title = str(formData.get("title"));
  const startAt = parseOptionalDate(formData.get("startAt"));
  if (!title || !startAt) return;
  await calendar().createEvent({
    title,
    startAt,
    endAt: parseOptionalDate(formData.get("endAt")),
    allDay: str(formData.get("allDay")) === "on",
    location: str(formData.get("location")) || null,
    description: str(formData.get("description")) || null,
    kind: (str(formData.get("kind")) || "personal") as CalendarEventKind,
  });
  revalidatePath("/calendar");
}

export async function updateEventAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  const startAt = parseOptionalDate(formData.get("startAt"));
  await calendar().updateEvent(id, {
    title: str(formData.get("title")),
    ...(startAt ? { startAt } : {}),
    endAt: parseOptionalDate(formData.get("endAt")),
    allDay: str(formData.get("allDay")) === "on",
    location: str(formData.get("location")) || null,
    description: str(formData.get("description")) || null,
    kind: (str(formData.get("kind")) || "personal") as CalendarEventKind,
  });
  revalidatePath("/calendar");
}

export async function deleteEventAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await calendar().deleteEvent(id);
  revalidatePath("/calendar");
}

/* ══ Mail: accounts + drafts ═════════════════════════════════════════ */

function mail() {
  return createMailAccountService(brainPrisma);
}

function parseAddresses(formData: FormData, field = "to"): string[] {
  return str(formData.get(field))
    .split(/[,;\n]/)
    .map((a) => a.trim())
    .filter(Boolean);
}

function parsePort(value: FormDataEntryValue | null): number | null {
  const n = Number.parseInt(str(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function createMailAccountAction(formData: FormData) {
  await requireBrainActionAuth();
  const label = str(formData.get("label"));
  const smtpHost = str(formData.get("smtpHost"));
  const username = str(formData.get("username"));
  // Passwords are stored encrypted (encryptSecret) — do not trim (may be significant).
  const password = String(formData.get("password") ?? "");
  if (!label || !smtpHost || !username || !password) return;
  await mail().createAccount({
    label,
    smtpHost,
    smtpPort: parsePort(formData.get("smtpPort")),
    imapHost: str(formData.get("imapHost")) || null,
    imapPort: parsePort(formData.get("imapPort")),
    username,
    password,
  });
  revalidatePath("/mail");
}

export async function createDraftAction(formData: FormData) {
  await requireBrainActionAuth();
  const subject = str(formData.get("subject"));
  const body = str(formData.get("bodyText"));
  if (!subject && !body) return;
  await mail().createDraft({
    subject: subject || "(kein Betreff)",
    toAddresses: parseAddresses(formData),
    bodyText: body || null,
    accountId: str(formData.get("accountId")) || null,
    status: "draft",
  });
  revalidatePath("/mail");
}

export async function updateDraftAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  await mail().updateDraft(id, {
    subject: str(formData.get("subject")),
    toAddresses: parseAddresses(formData),
    bodyText: str(formData.get("bodyText")) || null,
    accountId: str(formData.get("accountId")) || null,
  });
  revalidatePath("/mail");
}
