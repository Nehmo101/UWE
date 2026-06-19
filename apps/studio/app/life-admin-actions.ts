"use server";

import type {
  ContractBillingInterval,
  ContractStatus,
  HardwareStatus,
  PersonalProjectCategory,
  PersonalProjectStatus,
  WorkshopProjectType,
  WorkshopStatus,
} from "@uwe/database/server";
import { createLifeAdminService, createSettingsService, prisma } from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStudioTrusted } from "@/src/lib/authz";

function lifeAdmin() {
  return createLifeAdminService(prisma);
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
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
  revalidatePath("/contracts");
  revalidatePath("/hardware");
  revalidatePath("/life-brain");
}

export async function createProjectAction(formData: FormData) {
  assertStudioTrusted();

  await lifeAdmin().createPersonalProject({
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || ""),
    status: (String(formData.get("status") || "idea") as PersonalProjectStatus) || "idea",
    category: (String(formData.get("category") || "other") as PersonalProjectCategory) || "other",
    nextAction: String(formData.get("nextAction") || "").trim() || null,
    notes: String(formData.get("notes") || ""),
    costCents: parseOptionalInt(formData.get("costCents")),
    worldId: String(formData.get("worldId") || "").trim() || null,
  });
  revalidateAdminPaths();
  redirect("/projects");
}

export async function updateProjectAction(formData: FormData) {
  assertStudioTrusted();

  const id = String(formData.get("id"));
  await lifeAdmin().updatePersonalProject(id, {
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || ""),
    status: String(formData.get("status")) as PersonalProjectStatus,
    category: String(formData.get("category")) as PersonalProjectCategory,
    nextAction: String(formData.get("nextAction") || "").trim() || null,
    notes: String(formData.get("notes") || ""),
    costCents: parseOptionalInt(formData.get("costCents")),
  });
  revalidateAdminPaths();
}

export async function deleteProjectAction(formData: FormData) {
  assertStudioTrusted();

  await lifeAdmin().deletePersonalProject(String(formData.get("id")));
  revalidateAdminPaths();
}

export async function createWorkshopAction(formData: FormData) {
  assertStudioTrusted();

  await lifeAdmin().createWorkshopProject({
    title: String(formData.get("title") || "").trim(),
    projectType: String(formData.get("projectType") || "other") as WorkshopProjectType,
    status: (String(formData.get("status") || "idea") as WorkshopStatus) || "idea",
    description: String(formData.get("description") || ""),
    nextAction: String(formData.get("nextAction") || "").trim() || null,
    notes: String(formData.get("notes") || ""),
    costCents: parseOptionalInt(formData.get("costCents")),
    materialsNeeded: String(formData.get("materialsNeeded") || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    worldId: String(formData.get("worldId") || "").trim() || null,
  });
  revalidateAdminPaths();
  redirect("/workshop");
}

export async function updateWorkshopAction(formData: FormData) {
  assertStudioTrusted();

  const id = String(formData.get("id"));
  await lifeAdmin().updateWorkshopProject(id, {
    title: String(formData.get("title") || "").trim(),
    projectType: String(formData.get("projectType")) as WorkshopProjectType,
    status: String(formData.get("status")) as WorkshopStatus,
    description: String(formData.get("description") || ""),
    nextAction: String(formData.get("nextAction") || "").trim() || null,
    notes: String(formData.get("notes") || ""),
    costCents: parseOptionalInt(formData.get("costCents")),
  });
  revalidateAdminPaths();
}

export async function deleteWorkshopAction(formData: FormData) {
  assertStudioTrusted();

  await lifeAdmin().deleteWorkshopProject(String(formData.get("id")));
  revalidateAdminPaths();
}

export async function createContractAction(formData: FormData) {
  assertStudioTrusted();

  await lifeAdmin().createContractExpense({
    name: String(formData.get("name") || "").trim(),
    vendor: String(formData.get("vendor") || ""),
    status: (String(formData.get("status") || "active") as ContractStatus) || "active",
    billingInterval:
      (String(formData.get("billingInterval") || "monthly") as ContractBillingInterval) || "monthly",
    categoryLabel: String(formData.get("categoryLabel") || ""),
    amountCents: parseOptionalInt(formData.get("amountCents")),
    billingDay: parseOptionalInt(formData.get("billingDay")),
    startDate: parseOptionalDate(formData.get("startDate")),
    nextPaymentDate: parseOptionalDate(formData.get("nextPaymentDate")),
    cancelByDate: parseOptionalDate(formData.get("cancelByDate")),
    portalUrl: String(formData.get("portalUrl") || "").trim() || null,
    notes: String(formData.get("notes") || ""),
  });
  revalidateAdminPaths();
  redirect("/contracts");
}

export async function updateContractAction(formData: FormData) {
  assertStudioTrusted();

  const id = String(formData.get("id"));
  await lifeAdmin().updateContractExpense(id, {
    name: String(formData.get("name") || "").trim(),
    vendor: String(formData.get("vendor") || ""),
    status: String(formData.get("status")) as ContractStatus,
    billingInterval: String(formData.get("billingInterval")) as ContractBillingInterval,
    categoryLabel: String(formData.get("categoryLabel") || ""),
    amountCents: parseOptionalInt(formData.get("amountCents")),
    billingDay: parseOptionalInt(formData.get("billingDay")),
    nextPaymentDate: parseOptionalDate(formData.get("nextPaymentDate")),
    cancelByDate: parseOptionalDate(formData.get("cancelByDate")),
    portalUrl: String(formData.get("portalUrl") || "").trim() || null,
    notes: String(formData.get("notes") || ""),
  });
  revalidateAdminPaths();
}

export async function deleteContractAction(formData: FormData) {
  assertStudioTrusted();

  await lifeAdmin().deleteContractExpense(String(formData.get("id")));
  revalidateAdminPaths();
}

export async function createHardwareAction(formData: FormData) {
  assertStudioTrusted();

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
    metadata: {
      services: String(formData.get("services") || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    },
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
  assertStudioTrusted();

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
    metadata: {
      ...baseMetadata,
      services: servicesRaw,
    },
  });
  revalidateAdminPaths();
}

export async function addHardwareErrorAction(formData: FormData) {
  assertStudioTrusted();

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
  assertStudioTrusted();

  await lifeAdmin().recordHardwareCheck(String(formData.get("deviceId")));
  revalidateAdminPaths();
}

export async function toggleHardwareSetupStepAction(formData: FormData) {
  assertStudioTrusted();

  const deviceId = String(formData.get("deviceId"));
  const stepIndex = Number.parseInt(String(formData.get("stepIndex")), 10);
  await lifeAdmin().toggleHardwareSetupStep(deviceId, stepIndex);
  revalidateAdminPaths();
}

export async function deleteHardwareAction(formData: FormData) {
  assertStudioTrusted();

  await lifeAdmin().deleteHardwareDevice(String(formData.get("id")));
  revalidateAdminPaths();
}

export async function createLifeBrainDocumentAction(formData: FormData) {
  assertStudioTrusted();

  await lifeAdmin().createPersonalBrainDocument({
    title: String(formData.get("title") || "").trim(),
    content: String(formData.get("content") || ""),
    category: String(formData.get("category") || "").trim() || null,
  });
  revalidateAdminPaths();
  redirect("/life-brain");
}

export async function createLifeBrainFactAction(formData: FormData) {
  assertStudioTrusted();

  await lifeAdmin().createPersonalBrainFact({
    title: String(formData.get("title") || "").trim(),
    content: String(formData.get("content") || ""),
    factType: String(formData.get("factType") || "custom"),
  });
  revalidateAdminPaths();
  redirect("/life-brain");
}

export async function deleteLifeBrainDocumentAction(formData: FormData) {
  assertStudioTrusted();

  await lifeAdmin().deletePersonalBrainDocument(String(formData.get("id")));
  revalidateAdminPaths();
}

export async function deleteLifeBrainFactAction(formData: FormData) {
  assertStudioTrusted();

  await lifeAdmin().deletePersonalBrainFact(String(formData.get("id")));
  revalidateAdminPaths();
}

export async function setFavoriteWorldAction(formData: FormData) {
  assertStudioTrusted();

  const slug = String(formData.get("favoriteWorldSlug") || "").trim() || null;
  await createSettingsService(prisma).updateSettings({
    app: { favoriteWorldSlug: slug },
  });
  revalidatePath("/today");
  revalidatePath("/settings");
}
