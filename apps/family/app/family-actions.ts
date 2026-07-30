"use server";

import { createFamilyService, type FamilyChatScope } from "@uwe/database/family-service";
import { familyPrisma } from "@uwe/database/family-client";
import { revalidatePath } from "next/cache";
import { requireFamilyActionAuth } from "@/src/lib/family-action-auth";

/**
 * Schreibende Aktionen der Family-App.
 *
 * Jede prüft zuerst das Häkchen und übergibt dann die Benutzer-ID an den
 * Service — der entscheidet über Sichtbarkeit. Keine Aktion nimmt eine
 * `ownerUserId` aus dem Formular entgegen: sonst könnte ein Mitglied fremdes
 * Privates anlegen oder lesen.
 */

function service() {
  return createFamilyService(familyPrisma);
}

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function scopeOf(value: FormDataEntryValue | null): FamilyChatScope {
  return str(value) === "private" ? "private" : "shared";
}

function revalidateFamily(): void {
  for (const path of ["/", "/chat", "/chat/privat", "/members"]) {
    revalidatePath(path);
  }
}

export async function createConversationAction(formData: FormData) {
  const user = await requireFamilyActionAuth();
  const title = str(formData.get("title"));
  if (!title) return;

  await service().createConversation({
    title,
    scope: scopeOf(formData.get("scope")),
    userId: user.id,
  });
  revalidateFamily();
}

export async function deleteConversationAction(formData: FormData) {
  const user = await requireFamilyActionAuth();
  const id = str(formData.get("id"));
  if (id) await service().deleteConversation(id, user.id);
  revalidateFamily();
}

export async function appendMessageAction(formData: FormData) {
  const user = await requireFamilyActionAuth();
  const conversationId = str(formData.get("conversationId"));
  const content = str(formData.get("content"));
  if (!conversationId || !content) return;

  await service().appendMessage({
    conversationId,
    userId: user.id,
    role: "user",
    content,
  });
  revalidateFamily();
}

export async function createFactAction(formData: FormData) {
  const user = await requireFamilyActionAuth();
  const title = str(formData.get("title"));
  if (!title) return;

  await service().createFact({
    title,
    content: str(formData.get("content")),
    scope: scopeOf(formData.get("scope")),
    userId: user.id,
    tags: str(formData.get("tags"))
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    source: "manuell",
  });
  revalidateFamily();
}

export async function deleteFactAction(formData: FormData) {
  const user = await requireFamilyActionAuth();
  const id = str(formData.get("id"));
  if (id) await service().deleteFact(id, user.id);
  revalidateFamily();
}
