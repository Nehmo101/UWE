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
 *
 * Ein Eintrag darf mehrere Personen betreffen (Wurmkur für beide Katzen,
 * Grippeimpfung für die ganze Familie), mindestens aber eine.
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

function memberIdsOf(formData: FormData): string[] {
  return formData
    .getAll("memberIds")
    .map((value) => str(value))
    .filter((value) => value !== "");
}

export async function createHealthRecordAction(formData: FormData) {
  await requireFamilyActionAuth();

  const memberIds = memberIdsOf(formData);
  const title = str(formData.get("title"));
  if (memberIds.length === 0 || !title) return;

  await service().createRecord({
    memberIds,
    kind: kindOf(formData.get("kind")),
    title,
    notes: str(formData.get("notes")),
    occurredOn: dateOf(formData.get("occurredOn")),
    nextDueOn: dateOf(formData.get("nextDueOn")),
  });

  revalidateHealth();
}

/**
 * Ändert nur, wen ein bestehender Eintrag betrifft. Eine leere Auswahl wird
 * verworfen: ein Eintrag ohne Person gehört niemandem.
 */
export async function setHealthRecordMembersAction(formData: FormData) {
  await requireFamilyActionAuth();

  const id = str(formData.get("id"));
  const memberIds = memberIdsOf(formData);
  if (!id || memberIds.length === 0) return;

  await service().setRecordMembers(id, memberIds);

  revalidateHealth();
}

export async function deleteHealthRecordAction(formData: FormData) {
  await requireFamilyActionAuth();

  const id = str(formData.get("id"));
  if (id) await service().deleteRecord(id);

  revalidateHealth();
}
