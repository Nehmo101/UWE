"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAppRepository,
  isPageLinkRelationPreset,
} from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioContentEdit } from "@/src/lib/authz";

function editPath(worldSlug: string, category: string, pageSlug: string) {
  return `/worlds/${worldSlug}/${category}/${pageSlug}/edit`;
}

async function requirePageLinkEdit(
  worldSlug: string,
  pageId: string,
  linkId: string,
): Promise<void> {
  const repo = getAppRepository();
  const link = await repo.getPageLinkById(linkId);
  if (!link) {
    throw new Error("Verknüpfung nicht gefunden.");
  }

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    throw new Error("Welt nicht gefunden.");
  }

  const inWorld =
    link.sourcePage.worldId === world.id && link.targetPage.worldId === world.id;
  if (!inWorld) {
    throw new Error("Verknüpfung gehört nicht zu dieser Welt.");
  }

  if (link.sourcePageId !== pageId && link.targetPageId !== pageId) {
    throw new Error("Verknüpfung gehört nicht zu dieser Seite.");
  }

  await requireStudioContentEdit(worldSlug, pageId);
}

export async function createPageLinkAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const pageId = String(formData.get("pageId"));
  const pageSlug = String(formData.get("pageSlug"));
  const category = String(formData.get("category"));
  const targetPageId = String(formData.get("targetPageId") || "");
  const relationType = String(formData.get("relationType") || "");
  const labelRaw = String(formData.get("label") || "").trim();
  const label = labelRaw || null;

  await requireStudioContentEdit(worldSlug, pageId);

  if (!targetPageId) {
    throw new Error("Zielseite fehlt.");
  }
  if (targetPageId === pageId) {
    throw new Error("Eine Seite kann nicht mit sich selbst verknüpft werden.");
  }
  if (!isPageLinkRelationPreset(relationType)) {
    throw new Error("Ungültiger Relationstyp.");
  }

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  const targetPage = await repo.getPageById(targetPageId);
  if (!world || !targetPage || targetPage.worldId !== world.id) {
    throw new Error("Zielseite nicht gefunden.");
  }

  await repo.createPageLink({
    sourcePageId: pageId,
    targetPageId,
    relationType,
    label,
  });

  revalidatePath(editPath(worldSlug, category, pageSlug));
  redirect(`${editPath(worldSlug, category, pageSlug)}?saved=1`);
}

export async function updatePageLinkAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const pageId = String(formData.get("pageId"));
  const pageSlug = String(formData.get("pageSlug"));
  const category = String(formData.get("category"));
  const linkId = String(formData.get("linkId"));
  const relationType = String(formData.get("relationType") || "");
  const labelRaw = String(formData.get("label") || "").trim();
  const label = labelRaw || null;

  await requirePageLinkEdit(worldSlug, pageId, linkId);

  if (!isPageLinkRelationPreset(relationType)) {
    throw new Error("Ungültiger Relationstyp.");
  }

  await getAppRepository().updatePageLink(linkId, { relationType, label });

  revalidatePath(editPath(worldSlug, category, pageSlug));
  redirect(`${editPath(worldSlug, category, pageSlug)}?saved=1`);
}

export async function deletePageLinkAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const pageId = String(formData.get("pageId"));
  const pageSlug = String(formData.get("pageSlug"));
  const category = String(formData.get("category"));
  const linkId = String(formData.get("linkId"));

  await requirePageLinkEdit(worldSlug, pageId, linkId);

  await getAppRepository().deletePageLink(linkId);

  revalidatePath(editPath(worldSlug, category, pageSlug));
  redirect(`${editPath(worldSlug, category, pageSlug)}?saved=1`);
}
