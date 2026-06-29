"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createDevIdeaService,
  DEV_IDEA_STATUSES,
  prisma,
  type DevIdeaStatus,
} from "@uwe/database/server";
import { requireOwner } from "@/src/lib/auth";

function ideas() {
  return createDevIdeaService(prisma);
}

function parseStatus(value: FormDataEntryValue | null): DevIdeaStatus | undefined {
  const candidate = String(value ?? "");
  return (DEV_IDEA_STATUSES as readonly string[]).includes(candidate)
    ? (candidate as DevIdeaStatus)
    : undefined;
}

export async function createIdeaAction(formData: FormData): Promise<void> {
  await requireOwner();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    throw new Error("Titel ist erforderlich.");
  }

  const idea = await ideas().createIdea({
    title,
    body: String(formData.get("body") ?? ""),
    status: parseStatus(formData.get("status")) ?? "in_planning",
  });

  revalidatePath("/ideas");
  redirect(`/ideas?idea=${idea.id}`);
}

export async function updateIdeaAction(formData: FormData): Promise<void> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    throw new Error("Idee-ID fehlt.");
  }

  await ideas().updateIdea(id, {
    title: String(formData.get("title") ?? "").trim(),
    body: String(formData.get("body") ?? ""),
  });

  revalidatePath("/ideas");
  redirect(`/ideas?idea=${id}`);
}

export async function updateIdeaStatusAction(formData: FormData): Promise<void> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  const status = parseStatus(formData.get("status"));
  if (!id || !status) {
    throw new Error("Idee-ID und gültiger Status sind erforderlich.");
  }

  await ideas().updateStatus(id, status);

  revalidatePath("/ideas");
  redirect(`/ideas?idea=${id}`);
}

export async function deleteIdeaAction(formData: FormData): Promise<void> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    throw new Error("Idee-ID fehlt.");
  }

  await ideas().deleteIdea(id);

  revalidatePath("/ideas");
  redirect("/ideas");
}
