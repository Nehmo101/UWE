"use server";

import { familyPrisma } from "@uwe/database/family-client";
import {
  createFamilyHealthService,
  isFamilyHealthRecordKind,
  type FamilyHealthRecordKind,
} from "@uwe/family-core";
import { revalidatePath } from "next/cache";
import { requireFamilyActionAuth } from "@/src/lib/family-action-auth";

/**
 * Gesundheits- und Tierarzt-Akte.
 *
 * Der Haushalt pflegt sie gemeinsam — auch die Akte der Katze und die des
 * Kleinkinds, die sich beide nie selbst anmelden können. Ein Eintrag mit
 * Fälligkeit erscheint automatisch im Kalender und im Abo aufs Handy.
 */

function service() {
  return createFamilyHealthService(familyPrisma);
}

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function kindOf(value: FormDataEntryValue | null): FamilyHealthRecordKind {
  const raw = str(value);
  return isFamilyHealthRecordKind(raw) ? raw : "other";
}

/** `<input type="date">` als UTC-Mitternacht lesen — sonst rutscht der Tag. */
function dateOf(value: FormDataEntryValue | null): Date | null {
  const match = str(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function revalidateHealth(): void {
  for (const path of ["/health", "/calendar", "/"]) {
    revalidatePath(path);
  }
}

export async function createHealthRecordAction(formData: FormData) {
  await requireFamilyActionAuth();

  const memberId = str(formData.get("memberId"));
  const title = str(formData.get("title"));
  if (!memberId || !title) return;

  await service().createRecord({
    memberId,
    kind: kindOf(formData.get("kind")),
    title,
    notes: str(formData.get("notes")),
    occurredOn: dateOf(formData.get("occurredOn")),
    nextDueOn: dateOf(formData.get("nextDueOn")),
  });

  revalidateHealth();
}

export async function deleteHealthRecordAction(formData: FormData) {
  await requireFamilyActionAuth();

  const id = str(formData.get("id"));
  if (id) await service().deleteRecord(id);

  revalidateHealth();
}
