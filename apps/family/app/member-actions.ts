"use server";

import { familyPrisma } from "@uwe/database/family-client";
import {
  createFamilyMemberService,
  isFamilyMemberKind,
  type FamilyMemberKind,
} from "@uwe/family-core";
import { revalidatePath } from "next/cache";
import { requireFamilyActionAuth } from "@/src/lib/family-action-auth";

/**
 * Mitglieder des Haushalts anlegen und pflegen.
 *
 * Bewusst getrennt von `family-actions.ts`: dort geht es um Chat und Notizen,
 * hier um Personen. Ein Mitglied braucht kein Konto — Kleinkind, Gast und
 * Haustier werden hier von Hand angelegt und haben nie eine Anmeldung.
 *
 * Zugänge vergibt diese Seite weiterhin nicht: welche E-Mail-Adresse Family
 * betreten darf, entscheidet das Häkchen in der Kommandozentrale.
 */

function members() {
  return createFamilyMemberService(familyPrisma);
}

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function kindOf(value: FormDataEntryValue | null): FamilyMemberKind {
  const raw = str(value);
  return isFamilyMemberKind(raw) ? raw : "adult";
}

/**
 * `<input type="date">` liefert „JJJJ-MM-TT". Als UTC-Mitternacht lesen, damit
 * ein Geburtstag nicht je nach Zeitzone auf den Vortag rutscht.
 */
function dateOf(value: FormDataEntryValue | null): Date | null {
  const raw = str(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function revalidateMembers(): void {
  for (const path of ["/", "/members", "/calendar", "/health"]) {
    revalidatePath(path);
  }
}

/** Jede Person pflegt ihr eigenes Profil — die Kennung kommt aus der Sitzung. */
export async function updateOwnProfileAction(formData: FormData) {
  const user = await requireFamilyActionAuth();
  const service = members();

  const own = await service.ensureMemberForUser({
    userId: user.id,
    displayName: user.displayName,
  });

  await service.updateMember(own.id, {
    displayName: str(formData.get("displayName")) || user.displayName,
    colour: str(formData.get("colour")),
    note: str(formData.get("note")),
    birthdayOn: dateOf(formData.get("birthdayOn")),
    anniversaryOn: dateOf(formData.get("anniversaryOn")),
    anniversaryLabel: str(formData.get("anniversaryLabel")),
  });

  revalidateMembers();
}

/**
 * Legt ein Mitglied ohne Konto an. Jedes Family-Mitglied darf das — ein
 * Kleinkind oder eine Katze gehört dem Haushalt, nicht einer einzelnen Person.
 */
export async function createMemberAction(formData: FormData) {
  await requireFamilyActionAuth();

  const displayName = str(formData.get("displayName"));
  if (!displayName) return;

  await members().createMember({
    displayName,
    kind: kindOf(formData.get("kind")),
    colour: str(formData.get("colour")) || null,
    note: str(formData.get("note")),
    birthdayOn: dateOf(formData.get("birthdayOn")),
    anniversaryOn: dateOf(formData.get("anniversaryOn")),
    anniversaryLabel: str(formData.get("anniversaryLabel")),
  });

  revalidateMembers();
}

/** Ändert ein Mitglied ohne Konto. Konto-Profile pflegt ihre Person selbst. */
export async function updateMemberAction(formData: FormData) {
  await requireFamilyActionAuth();

  const id = str(formData.get("id"));
  if (!id) return;

  const service = members();
  const member = await service.getMember(id);
  if (!member || member.userId) return;

  await service.updateMember(id, {
    displayName: str(formData.get("displayName")) || member.displayName,
    kind: kindOf(formData.get("kind")),
    colour: str(formData.get("colour")),
    note: str(formData.get("note")),
    birthdayOn: dateOf(formData.get("birthdayOn")),
    anniversaryOn: dateOf(formData.get("anniversaryOn")),
    anniversaryLabel: str(formData.get("anniversaryLabel")),
  });

  revalidateMembers();
}

export async function removeMemberAction(formData: FormData) {
  await requireFamilyActionAuth();

  const id = str(formData.get("id"));
  if (id) await members().removeMember(id);

  revalidateMembers();
}
