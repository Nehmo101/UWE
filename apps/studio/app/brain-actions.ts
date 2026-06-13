"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createBrainStoreService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";

function getBrainDeps() {
  const db = createPrismaClient();
  return { db, brain: createBrainStoreService(), repo: getAppRepository() };
}

export async function createBrainDocumentAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const documentType = String(formData.get("documentType") || "general");
  const visibility = String(formData.get("visibility") || "dm_only");
  const campaignId = String(formData.get("campaignId") || "") || null;

  if (!title) {
    throw new Error("Titel ist erforderlich");
  }

  const { db, brain, repo } = getBrainDeps();
  let documentId: string | null = null;

  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) throw new Error("Welt nicht gefunden");

    const document = await brain.createDocument({
      worldId: world.id,
      title,
      content,
      documentType: documentType as never,
      visibility: visibility as never,
      campaignId,
      status: "draft",
      source: "manual",
    });
    documentId = document.id;
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/brain`);
  if (documentId) {
    redirect(`/worlds/${worldSlug}/brain/${documentId}`);
  }
}

export async function createBrainFactAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const factType = String(formData.get("factType") || "custom");
  const visibility = String(formData.get("visibility") || "dm_only");
  const campaignId = String(formData.get("campaignId") || "") || null;

  if (!title) {
    throw new Error("Titel ist erforderlich");
  }

  const { db, brain, repo } = getBrainDeps();
  let factId: string | null = null;

  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) throw new Error("Welt nicht gefunden");

    const fact = await brain.createFact({
      worldId: world.id,
      title,
      content,
      factType: factType as never,
      visibility: visibility as never,
      campaignId,
      status: "draft",
      source: "manual",
    });
    factId = fact.id;
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/brain`);
  if (factId) {
    redirect(`/worlds/${worldSlug}/brain/facts/${factId}`);
  }
}

export async function updateBrainDocumentAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const documentId = String(formData.get("documentId"));
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "");
  const documentType = String(formData.get("documentType") || "general");
  const visibility = String(formData.get("visibility") || "dm_only");
  const status = String(formData.get("status") || "draft");

  const { db, brain } = getBrainDeps();
  try {
    await brain.updateDocument(documentId, {
      title,
      content,
      documentType: documentType as never,
      visibility: visibility as never,
      status: status as never,
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/brain`);
  revalidatePath(`/worlds/${worldSlug}/brain/${documentId}`);
}

export async function updateBrainFactAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const factId = String(formData.get("factId"));
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "");
  const factType = String(formData.get("factType") || "custom");
  const visibility = String(formData.get("visibility") || "dm_only");
  const status = String(formData.get("status") || "draft");

  const { db, brain } = getBrainDeps();
  try {
    await brain.updateFact(factId, {
      title,
      content,
      factType: factType as never,
      visibility: visibility as never,
      status: status as never,
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/brain`);
  revalidatePath(`/worlds/${worldSlug}/brain/facts/${factId}`);
}
