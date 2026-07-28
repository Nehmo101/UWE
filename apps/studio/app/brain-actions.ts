"use server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createBrainStoreService,
  getAppRepository,
} from "@uwe/database/server";
import { requireStudioWorldEdit } from "@/src/lib/authz";

// createBrainStoreService() and getAppRepository() both run on the shared
// prisma client — the world-brain tables live in the core DB, not in the
// owner-private Brain DB (that one is reached via `brainPrisma`, not here).
function getBrainDeps() {
  return { brain: createBrainStoreService(), repo: getAppRepository() };
}

export async function createBrainDocumentAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const documentType = String(formData.get("documentType") || "general");
  const campaignId = String(formData.get("campaignId") || "") || null;

  if (!title) {
    throw new Error("Titel ist erforderlich");
  }

  await requireStudioWorldEdit(worldSlug);

  const { brain, repo } = getBrainDeps();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) throw new Error("Welt nicht gefunden");

  const document = await brain.createDocument({
    worldId: world.id,
    title,
    content,
    documentType: documentType as never,
    campaignId,
    status: "draft",
    source: "manual",
  });
  const documentId: string | null = document.id;

  revalidatePath(`/worlds/${worldSlug}/brain`);
  if (documentId) {
    redirect(`/worlds/${worldSlug}/brain/${documentId}`);
  }
}

export async function createBrainFactAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const factType = String(formData.get("factType") || "custom");
  const campaignId = String(formData.get("campaignId") || "") || null;

  if (!title) {
    throw new Error("Titel ist erforderlich");
  }

  await requireStudioWorldEdit(worldSlug);

  const { brain, repo } = getBrainDeps();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) throw new Error("Welt nicht gefunden");

  const fact = await brain.createFact({
    worldId: world.id,
    title,
    content,
    factType: factType as never,
    campaignId,
    status: "draft",
    source: "manual",
  });
  const factId: string | null = fact.id;

  revalidatePath(`/worlds/${worldSlug}/brain`);
  if (factId) {
    redirect(`/worlds/${worldSlug}/brain/facts/${factId}`);
  }
}

export async function updateBrainDocumentAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const documentId = String(formData.get("documentId"));
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "");
  const documentType = String(formData.get("documentType") || "general");
  const status = String(formData.get("status") || "draft");

  await requireStudioWorldEdit(worldSlug);

  const { brain } = getBrainDeps();
  await brain.updateDocument(documentId, {
    title,
    content,
    documentType: documentType as never,
    status: status as never,
  });

  revalidatePath(`/worlds/${worldSlug}/brain`);
  revalidatePath(`/worlds/${worldSlug}/brain/${documentId}`);
}

export async function updateBrainFactAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const factId = String(formData.get("factId"));
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "");
  const factType = String(formData.get("factType") || "custom");
  const status = String(formData.get("status") || "draft");

  await requireStudioWorldEdit(worldSlug);

  const { brain } = getBrainDeps();
  await brain.updateFact(factId, {
    title,
    content,
    factType: factType as never,
    status: status as never,
  });

  revalidatePath(`/worlds/${worldSlug}/brain`);
  revalidatePath(`/worlds/${worldSlug}/brain/facts/${factId}`);
}
