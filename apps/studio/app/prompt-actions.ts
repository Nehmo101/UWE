"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@uwe/database/server";
import {
  createPromptLibraryService,
  type PromptTemplateCategory,
  type PromptTemplateInput,
} from "@uwe/database/prompt-library";
import { assertStudioTrusted } from "@/src/lib/authz";

function library() {
  return createPromptLibraryService(prisma);
}

function readForm(formData: FormData): PromptTemplateInput {
  return {
    title: String(formData.get("title") || "").trim(),
    category: (String(formData.get("category") || "other") as PromptTemplateCategory),
    description: String(formData.get("description") || ""),
    body: String(formData.get("body") || ""),
    tags: String(formData.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

export async function createPromptAction(formData: FormData) {
  assertStudioTrusted();
  const prompt = await library().create(readForm(formData));
  revalidatePath("/prompts");
  redirect(`/prompts/${prompt.id}`);
}

export async function updatePromptAction(formData: FormData) {
  assertStudioTrusted();
  const id = String(formData.get("id"));
  await library().update(id, readForm(formData));
  revalidatePath("/prompts");
  revalidatePath(`/prompts/${id}`);
  redirect(`/prompts/${id}?saved=1`);
}

export async function deletePromptAction(formData: FormData) {
  assertStudioTrusted();
  await library().remove(String(formData.get("id")));
  revalidatePath("/prompts");
  redirect("/prompts");
}
