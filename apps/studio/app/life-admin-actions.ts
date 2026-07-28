"use server";
import { brainPrisma } from "@uwe/database/brain-client";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { createLifeAdminService, prisma } from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { enqueueAndDispatch } from "@/src/lib/job-executor";

function lifeAdmin() {
  return createLifeAdminService(brainPrisma, prisma);
}

function revalidateAdminPaths() {
  revalidatePath("/capture");
  revalidatePath("/hardware");
  revalidatePath("/life-brain");
}

export async function advanceWorkshopStatusAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  await lifeAdmin().advanceWorkshopStatus(id);
  revalidateAdminPaths();
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

