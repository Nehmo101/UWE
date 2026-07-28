"use server";

import {
  createLifeAdminService,
  prisma,
  type ContractBillingInterval,
  type ContractExpenseType,
  type ContractStatus,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { familyPrisma } from "@uwe/database/family-client";
import { revalidatePath } from "next/cache";
import { requireFamilyActionAuth } from "@/src/lib/family-action-auth";

/**
 * Verträge und wiederkehrende Kosten (H7).
 *
 * Family teilt sich diese Daten: wer das Häkchen hat, darf jeden Vertrag sehen
 * und bearbeiten. Es gibt bewusst keinen Eigentümer je Vertrag — der Haushalt
 * zahlt gemeinsam, also verwaltet er auch gemeinsam.
 *
 * Der Life-Admin-Service braucht neben der Family-DB weiter den Brain-Client
 * (Verknüpfungen bleiben owner-privat) und die Kern-DB.
 */

function contracts() {
  return createLifeAdminService(brainPrisma, prisma, familyPrisma);
}

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

/** „39,99" wie „39.99" → Cent. Leer bleibt leer, nicht 0. */
function euroToCents(value: FormDataEntryValue | null): number | undefined {
  const raw = str(value).replace(",", ".");
  if (!raw) return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
}

function date(value: FormDataEntryValue | null): Date | undefined {
  const raw = str(value);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function revalidateContracts(): void {
  revalidatePath("/contracts");
  revalidatePath("/");
}

function fieldsFrom(formData: FormData) {
  return {
    name: str(formData.get("name")),
    vendor: str(formData.get("vendor")),
    categoryLabel: str(formData.get("categoryLabel")),
    status: (str(formData.get("status")) || "active") as ContractStatus,
    expenseType: (str(formData.get("expenseType")) || "other") as ContractExpenseType,
    billingInterval: (str(formData.get("billingInterval")) || "monthly") as ContractBillingInterval,
    amountCents: euroToCents(formData.get("amountEuros")),
    nextPaymentDate: date(formData.get("nextPaymentDate")),
    cancelByDate: date(formData.get("cancelByDate")),
    renewalDate: date(formData.get("renewalDate")),
    portalUrl: str(formData.get("portalUrl")),
    notes: str(formData.get("notes")),
  };
}

export async function createContractAction(formData: FormData) {
  await requireFamilyActionAuth();
  const fields = fieldsFrom(formData);
  if (!fields.name) return;

  await contracts().createContractExpense(fields);
  revalidateContracts();
}

export async function updateContractAction(formData: FormData) {
  await requireFamilyActionAuth();
  const id = str(formData.get("id"));
  const fields = fieldsFrom(formData);
  if (!id || !fields.name) return;

  await contracts().updateContractExpense(id, fields);
  revalidateContracts();
}

export async function deleteContractAction(formData: FormData) {
  await requireFamilyActionAuth();
  const id = str(formData.get("id"));
  if (id) await contracts().deleteContractExpense(id);
  revalidateContracts();
}
