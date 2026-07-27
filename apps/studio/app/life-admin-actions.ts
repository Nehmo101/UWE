"use server";
import { brainPrisma } from "@uwe/database/brain-client";
import { familyPrisma } from "@uwe/database/family-client";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import type {
  ContractBillingInterval,
  ContractStatus,
} from "@uwe/database/server";
import {
  createCalendarService,
  createLifeAdminService,
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
  revalidatePath("/capture");
  revalidatePath("/contracts");
  revalidatePath("/hardware");
  revalidatePath("/life-brain");
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
  await createCalendarService(familyPrisma, prisma).syncContractDeadlinesToCalendar();
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
  await createCalendarService(familyPrisma, prisma).syncContractDeadlinesToCalendar();
  revalidateAdminPaths();
}

export async function deleteContractAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().deleteContractExpense(String(formData.get("id")));
  await createCalendarService(familyPrisma, prisma).syncContractDeadlinesToCalendar();
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

