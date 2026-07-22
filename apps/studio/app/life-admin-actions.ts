"use server";
import { brainPrisma } from "@uwe/database/brain-client";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import type {
  ContractBillingInterval,
  ContractStatus,
  HardwareStatus,
  PersonalProjectCategory,
  PersonalProjectStatus,
} from "@uwe/database/server";
import {
  createCalendarService,
  createLifeAdminService,
  createSettingsService,
  mergeHardwareRunbookMetadata,
  parseLinksFromForm,
  PersonalProjectStatusEnum,
  prisma,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { enqueueAndDispatch } from "@/src/lib/job-executor";

function lifeAdmin() {
  return createLifeAdminService(brainPrisma, prisma);
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Euro-Eingabe ("9,99" oder "9.99") in Cents; akzeptiert Komma als Dezimaltrenner. */
function parseOptionalEuroToCents(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function revalidateAdminPaths() {
  revalidatePath("/today");
  revalidatePath("/capture");
  revalidatePath("/projects");
  revalidatePath("/workshop");
  revalidatePath("/workshop/recipes");
  revalidatePath("/workshop/rental");
  revalidatePath("/workshop/print-profiles");
  revalidatePath("/contracts");
  revalidatePath("/hardware");
  revalidatePath("/life-brain");
}

export async function createProjectAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().createPersonalProject({
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || ""),
    status: (String(formData.get("status") || "idea") as PersonalProjectStatus) || "idea",
    category: (String(formData.get("category") || "other") as PersonalProjectCategory) || "other",
    nextAction: String(formData.get("nextAction") || "").trim() || null,
    nextActionDate: parseOptionalDate(formData.get("nextActionDate")),
    notes: String(formData.get("notes") || ""),
    links: parseLinksFromForm(String(formData.get("links") || "")),
    costCents: parseOptionalInt(formData.get("costCents")),
    worldId: String(formData.get("worldId") || "").trim() || null,
  });
  revalidateAdminPaths();
  redirect("/projects");
}

export async function updateProjectAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  await lifeAdmin().updatePersonalProject(id, {
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || ""),
    status: String(formData.get("status")) as PersonalProjectStatus,
    category: String(formData.get("category")) as PersonalProjectCategory,
    nextAction: String(formData.get("nextAction") || "").trim() || null,
    nextActionDate: parseOptionalDate(formData.get("nextActionDate")),
    notes: String(formData.get("notes") || ""),
    links: parseLinksFromForm(String(formData.get("links") || "")),
    costCents: parseOptionalInt(formData.get("costCents")),
  });
  revalidateAdminPaths();
  revalidatePath(`/projects/${id}`);
}

export async function updateProjectStatusAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as PersonalProjectStatus;
  if (!id || !Object.values(PersonalProjectStatusEnum).includes(status)) {
    return;
  }

  await lifeAdmin().updatePersonalProject(id, { status });
  revalidateAdminPaths();
  revalidatePath(`/projects/${id}`);
}

export async function deleteProjectAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().deletePersonalProject(String(formData.get("id")));
  revalidateAdminPaths();
  redirect("/projects");
}

export async function addProjectStepAction(formData: FormData) {
  await requireStudioActionAuth();

  const projectId = String(formData.get("projectId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  if (!projectId || !title) {
    return;
  }
  await lifeAdmin().addProjectStep(projectId, title);
  revalidatePath(`/projects/${projectId}`);
}

export async function toggleProjectStepAction(formData: FormData) {
  await requireStudioActionAuth();

  const projectId = String(formData.get("projectId") || "").trim();
  const stepId = String(formData.get("stepId") || "").trim();
  if (!projectId || !stepId) {
    return;
  }
  await lifeAdmin().setProjectStepDone(stepId, formData.get("done") === "1");
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectStepAction(formData: FormData) {
  await requireStudioActionAuth();

  const projectId = String(formData.get("projectId") || "").trim();
  const stepId = String(formData.get("stepId") || "").trim();
  if (!projectId || !stepId) {
    return;
  }
  await lifeAdmin().deleteProjectStep(stepId);
  revalidatePath(`/projects/${projectId}`);
}

export async function advanceWorkshopStatusAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  await lifeAdmin().advanceWorkshopStatus(id);
  revalidateAdminPaths();
}

export async function createContractAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().createContractExpense({
    name: String(formData.get("name") || "").trim(),
    vendor: String(formData.get("vendor") || ""),
    status: (String(formData.get("status") || "active") as ContractStatus) || "active",
    billingInterval:
      (String(formData.get("billingInterval") || "monthly") as ContractBillingInterval) || "monthly",
    categoryLabel: String(formData.get("categoryLabel") || ""),
    amountCents: parseOptionalEuroToCents(formData.get("amountEuros")),
    billingDay: parseOptionalInt(formData.get("billingDay")),
    startDate: parseOptionalDate(formData.get("startDate")),
    nextPaymentDate: parseOptionalDate(formData.get("nextPaymentDate")),
    cancelByDate: parseOptionalDate(formData.get("cancelByDate")),
    portalUrl: String(formData.get("portalUrl") || "").trim() || null,
    notes: String(formData.get("notes") || ""),
  });
  await createCalendarService(brainPrisma, prisma).syncContractDeadlinesToCalendar();
  revalidateAdminPaths();
  redirect("/contracts");
}

export async function updateContractAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  await lifeAdmin().updateContractExpense(id, {
    name: String(formData.get("name") || "").trim(),
    vendor: String(formData.get("vendor") || ""),
    status: String(formData.get("status")) as ContractStatus,
    billingInterval: String(formData.get("billingInterval")) as ContractBillingInterval,
    categoryLabel: String(formData.get("categoryLabel") || ""),
    amountCents: parseOptionalEuroToCents(formData.get("amountEuros")),
    billingDay: parseOptionalInt(formData.get("billingDay")),
    nextPaymentDate: parseOptionalDate(formData.get("nextPaymentDate")),
    cancelByDate: parseOptionalDate(formData.get("cancelByDate")),
    portalUrl: String(formData.get("portalUrl") || "").trim() || null,
    notes: String(formData.get("notes") || ""),
  });
  await createCalendarService(brainPrisma, prisma).syncContractDeadlinesToCalendar();
  revalidateAdminPaths();
}

export async function deleteContractAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().deleteContractExpense(String(formData.get("id")));
  await createCalendarService(brainPrisma, prisma).syncContractDeadlinesToCalendar();
  revalidateAdminPaths();
}

export async function syncAiUsageContractAction(formData: FormData) {
  await requireStudioActionAuth();

  const periodRaw = String(formData.get("period") || "current_month");
  const period =
    periodRaw === "last_30_days" || periodRaw === "current_year"
      ? periodRaw
      : "current_month";

  await lifeAdmin().syncAiUsageContractExpense({ period });
  revalidateAdminPaths();
  redirect(`/contracts?period=${period}&aiSynced=1`);
}

export async function createHardwareAction(formData: FormData) {
  await requireStudioActionAuth();

  const runbook = String(formData.get("runbook") || "").trim();

  await lifeAdmin().createHardwareDevice({
    name: String(formData.get("name") || "").trim(),
    role: String(formData.get("role") || ""),
    status: (String(formData.get("status") || "planned") as HardwareStatus) || "planned",
    hostname: String(formData.get("hostname") || "").trim() || null,
    ipAddress: String(formData.get("ipAddress") || "").trim() || null,
    localUrl: String(formData.get("localUrl") || "").trim() || null,
    publicUrl: String(formData.get("publicUrl") || "").trim() || null,
    operatingSystem: String(formData.get("operatingSystem") || ""),
    errorNotes: String(formData.get("errorNotes") || "").trim() || null,
    notes: String(formData.get("notes") || ""),
    specs: String(formData.get("specs") || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    metadata: mergeHardwareRunbookMetadata(
      {
        services: String(formData.get("services") || "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      },
      runbook,
    ),
    setupSteps: String(formData.get("setupSteps") || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((label) => ({ label, done: false })),
  });
  revalidateAdminPaths();
  redirect("/hardware");
}

export async function updateHardwareAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  const servicesRaw = String(formData.get("services") || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const specsRaw = String(formData.get("specs") || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const device = await lifeAdmin().getHardwareDevice(id);
  const baseMetadata =
    device?.metadata && typeof device.metadata === "object"
      ? { ...(device.metadata as Record<string, unknown>) }
      : {};
  const runbook = String(formData.get("runbook") || "");

  await lifeAdmin().updateHardwareDevice(id, {
    name: String(formData.get("name") || "").trim(),
    role: String(formData.get("role") || ""),
    status: String(formData.get("status")) as HardwareStatus,
    hostname: String(formData.get("hostname") || "").trim() || null,
    ipAddress: String(formData.get("ipAddress") || "").trim() || null,
    localUrl: String(formData.get("localUrl") || "").trim() || null,
    publicUrl: String(formData.get("publicUrl") || "").trim() || null,
    operatingSystem: String(formData.get("operatingSystem") || ""),
    specs: specsRaw.length > 0 ? specsRaw : null,
    errorNotes: String(formData.get("errorNotes") || "").trim() || null,
    notes: String(formData.get("notes") || ""),
    metadata: mergeHardwareRunbookMetadata(
      { ...baseMetadata, services: servicesRaw },
      runbook,
    ),
  });
  revalidateAdminPaths();
}

export async function addHardwareErrorAction(formData: FormData) {
  await requireStudioActionAuth();

  const deviceId = String(formData.get("deviceId"));
  const affectedRaw = String(formData.get("affectedServices") || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  await lifeAdmin().addHardwareErrorEntry(deviceId, {
    problem: String(formData.get("problem") || "").trim(),
    resolution: String(formData.get("resolution") || "").trim() || undefined,
    affectedServices: affectedRaw.length > 0 ? affectedRaw : undefined,
  });
  revalidateAdminPaths();
}

export async function recordHardwareCheckAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().recordHardwareCheck(String(formData.get("deviceId")));
  revalidateAdminPaths();
}

export async function toggleHardwareSetupStepAction(formData: FormData) {
  await requireStudioActionAuth();

  const deviceId = String(formData.get("deviceId"));
  const stepIndex = Number.parseInt(String(formData.get("stepIndex")), 10);
  await lifeAdmin().toggleHardwareSetupStep(deviceId, stepIndex);
  revalidateAdminPaths();
}

export async function deleteHardwareAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().deleteHardwareDevice(String(formData.get("id")));
  revalidateAdminPaths();
}

function parseCommaTags(formData: FormData, field = "tags"): string[] {
  return String(formData.get(field) || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function createLifeBrainDocumentAction(formData: FormData) {
  await requireStudioActionAuth();

  const document = await lifeAdmin().createPersonalBrainDocument({
    title: String(formData.get("title") || "").trim(),
    content: String(formData.get("content") || ""),
    category: String(formData.get("category") || "").trim() || null,
    tags: parseCommaTags(formData),
  });

  await enqueueAndDispatch({
    type: "embedding",
    title: `Life Brain Index · ${document.title}`,
    payload: {
      personalBrainDocumentId: document.id,
      useMock: process.env.AI_USE_MOCK === "true",
    },
    relatedType: "personal_brain_document",
    relatedId: document.id,
  });

  revalidateAdminPaths();
  redirect("/life-brain");
}

export async function createLifeBrainFactAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().createPersonalBrainFact({
    title: String(formData.get("title") || "").trim(),
    content: String(formData.get("content") || ""),
    factType: String(formData.get("factType") || "custom"),
    tags: parseCommaTags(formData),
  });
  revalidateAdminPaths();
  redirect("/life-brain");
}

export async function updateLifeBrainDocumentAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  const title = String(formData.get("title") || "").trim();
  if (!title) {
    throw new Error("Titel erforderlich.");
  }

  const document = await lifeAdmin().updatePersonalBrainDocument(id, {
    title,
    content: String(formData.get("content") || ""),
  });

  await enqueueAndDispatch({
    type: "embedding",
    title: `Life Brain Index · ${document.title}`,
    payload: {
      personalBrainDocumentId: document.id,
      useMock: process.env.AI_USE_MOCK === "true",
    },
    relatedType: "personal_brain_document",
    relatedId: document.id,
  });

  revalidateAdminPaths();
  revalidatePath(`/life-brain/documents/${id}`);
}

export async function updateLifeBrainDocumentTagsAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  const document = await lifeAdmin().updatePersonalBrainDocument(id, {
    tags: parseCommaTags(formData),
  });

  await enqueueAndDispatch({
    type: "embedding",
    title: `Life Brain Index · ${document.title}`,
    payload: {
      personalBrainDocumentId: document.id,
      useMock: process.env.AI_USE_MOCK === "true",
    },
    relatedType: "personal_brain_document",
    relatedId: document.id,
  });

  revalidateAdminPaths();
  revalidatePath(`/life-brain/documents/${id}`);
}

export async function updateLifeBrainFactTagsAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().updatePersonalBrainFact(String(formData.get("id")), {
    tags: parseCommaTags(formData),
  });
  revalidateAdminPaths();
}

export async function deleteLifeBrainDocumentAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().deletePersonalBrainDocument(String(formData.get("id")));
  revalidateAdminPaths();
}

export async function deleteLifeBrainFactAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().deletePersonalBrainFact(String(formData.get("id")));
  revalidateAdminPaths();
}

export async function setFavoriteWorldAction(formData: FormData) {
  await requireStudioActionAuth();

  const slug = String(formData.get("favoriteWorldSlug") || "").trim() || null;
  await createSettingsService(prisma).updateSettings({
    app: { favoriteWorldSlug: slug },
  });
  revalidatePath("/today");
  revalidatePath("/settings");
}
