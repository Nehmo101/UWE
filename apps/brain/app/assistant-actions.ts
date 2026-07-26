"use server";
import fs from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { brainPrisma } from "@uwe/database/brain-client";
import { getSystemSettings, resolveEffectiveUploadsPath } from "@uwe/database/server";
import { resolveAssetFilePath } from "@uwe/assets";
import { ASSISTANT_CONTEXT_MODES, createBrainAssistantService } from "@uwe/brain-assistant";
import type { AssistantContextMode } from "@uwe/brain-assistant/types";
import { parseAssistantModelRef } from "@/src/lib/assistant-model-ref";
import { requireBrainActionAuth } from "@/src/lib/brain-action-auth";

/**
 * Server actions for the Brain KI-Chat. Kept in their own file: the shared
 * `brain-actions.ts` is already 612 of its 700 allowed lines.
 *
 * Every action re-checks the owner role — middleware only gates page loads.
 */

function service() {
  return createBrainAssistantService(brainPrisma);
}

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function parseContextMode(value: FormDataEntryValue | null): AssistantContextMode {
  const raw = str(value);
  return (ASSISTANT_CONTEXT_MODES as readonly string[]).includes(raw)
    ? (raw as AssistantContextMode)
    : "plain";
}

function revalidateAssistant(conversationId?: string) {
  revalidatePath("/ki-chat");
  if (conversationId) {
    revalidatePath(`/ki-chat/${conversationId}`);
  }
}

/** Assign the AI transferred from the Command Center ("KI hinterlegen"). */
export async function saveAssistantProfileAction(formData: FormData) {
  await requireBrainActionAuth();
  await service().saveProfile({
    chat: parseAssistantModelRef(str(formData.get("chatModel"))),
    vision: parseAssistantModelRef(str(formData.get("visionModel"))),
    sttModelName: str(formData.get("sttModelName")) || null,
    systemPrompt: str(formData.get("systemPrompt")),
    defaultContextMode: parseContextMode(formData.get("defaultContextMode")),
  });
  revalidateAssistant();
}

export async function createConversationAction(formData: FormData) {
  await requireBrainActionAuth();
  const profile = await service().getProfile();
  const id = await service().createConversation({
    title: str(formData.get("title")) || undefined,
    contextMode: profile.defaultContextMode,
  });
  revalidateAssistant(id);
  redirect(`/ki-chat/${id}`);
}

export async function renameConversationAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("conversationId"));
  if (!id) throw new Error("Keine Unterhaltung gewählt.");
  await service().renameConversation(id, str(formData.get("title")));
  revalidateAssistant(id);
}

export async function deleteConversationAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("conversationId"));
  if (!id) throw new Error("Keine Unterhaltung gewählt.");

  // Files first: the DB rows cascade away, so read the keys while they exist.
  const storageKeys = await service().listStorageKeysForConversation(id);
  await service().deleteConversation(id);

  const uploadsRoot = resolveEffectiveUploadsPath(await getSystemSettings());
  for (const storageKey of storageKeys) {
    try {
      await fs.rm(resolveAssetFilePath(storageKey, undefined, uploadsRoot), { force: true });
    } catch {
      // Eine verwaiste Datei ist ärgerlich, aber kein Grund, das Löschen zu stoppen.
    }
  }

  revalidateAssistant();
  redirect("/ki-chat");
}

/** Per-conversation override of the assigned model; empty resets to the profile. */
export async function setConversationModelAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("conversationId"));
  if (!id) throw new Error("Keine Unterhaltung gewählt.");
  await service().setConversationModel(id, parseAssistantModelRef(str(formData.get("chatModel"))));
  revalidateAssistant(id);
}

export async function setConversationContextModeAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("conversationId"));
  if (!id) throw new Error("Keine Unterhaltung gewählt.");
  await service().setContextMode(id, parseContextMode(formData.get("contextMode")));
  revalidateAssistant(id);
}
