"use server";
import { familyPrisma } from "@uwe/database/family-client";

import { requireFamilyActionAuth } from "@/src/lib/family-action-auth";
import {
  createMaintenanceService,
  MAINTENANCE_INTERVALS,
  type MaintenanceInterval,
} from "@uwe/database/maintenance";
import { prisma } from "@uwe/database/server";
import { revalidatePath } from "next/cache";

function household() {
  return createMaintenanceService(familyPrisma, prisma);
}

function parseInterval(value: FormDataEntryValue | null): MaintenanceInterval {
  const raw = String(value ?? "");
  return (MAINTENANCE_INTERVALS as readonly string[]).includes(raw)
    ? (raw as MaintenanceInterval)
    : "yearly";
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function createMaintenanceTaskAction(formData: FormData) {
  await requireFamilyActionAuth();

  const title = String(formData.get("title") || "").trim();
  if (!title) return;

  await household().create({
    title,
    category: String(formData.get("category") || "").trim(),
    interval: parseInterval(formData.get("interval")),
    nextDueAt: parseOptionalDate(formData.get("nextDueAt")),
    notes: String(formData.get("notes") || "").trim(),
  });
  revalidatePath("/household");
}

export async function markMaintenanceDoneAction(formData: FormData) {
  await requireFamilyActionAuth();

  const id = String(formData.get("id") || "").trim();
  if (id) {
    await household().markDone(id, new Date());
  }
  revalidatePath("/household");
}

export async function deleteMaintenanceTaskAction(formData: FormData) {
  await requireFamilyActionAuth();

  const id = String(formData.get("id") || "").trim();
  if (id) {
    await household().remove(id);
  }
  revalidatePath("/household");
}
