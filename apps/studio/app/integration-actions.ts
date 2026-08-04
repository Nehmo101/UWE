"use server";

import {
  requireStudioActionAuth,
  requireStudioAiActionAuth,
} from "@/src/lib/studio-action-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildStorageKey,
} from "@uwe/assets";
import {
  adoptAssetToTarget,
  createDndApiService,
  createImageStudioService,
  createJobService,
  getAppRepository,
  getSystemSettings,
  prisma,
  syncImageStudioProjectLinksToAsset,
} from "@uwe/database/server";
import { storeUploadedAsset } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import type { ImageStudioLinkTargetType } from "@uwe/database/server";
import type { ImageStudioPromptContextMode } from "@uwe/image-studio";
import { dispatchJob } from "@/src/lib/job-executor";
import {
  assertStudioCanUseAI,
  requireStudioWorldEdit,
} from "@/src/lib/authz";

export async function createImageStudioJobAction(formData: FormData) {
  await requireStudioAiActionAuth();
  const settings = await getSystemSettings();
  const config = {
    enabled: settings.imageStudio.enabled,
    backgroundRemovalEnabled: settings.imageStudio.backgroundRemovalEnabled,
  };
  if (!config.enabled) throw new Error("Image Studio ist deaktiviert.");

  const worldSlug = String(formData.get("worldSlug") ?? "");
  const prompt = String(formData.get("prompt") ?? "");
  const task = String(formData.get("task") ?? "generate") as
    | "generate"
    | "edit"
    | "inpaint"
    | "remove_background"
    | "variant";
  const title = String(formData.get("title") ?? "") || undefined;
  const sourceImageBase64 = String(formData.get("sourceImageBase64") ?? "") || undefined;
  const maskBase64 = String(formData.get("maskBase64") ?? "") || undefined;
  const pageId = String(formData.get("pageId") ?? "") || undefined;
  const existingProjectId = String(formData.get("projectId") ?? "") || undefined;
  const linkTargetType = String(formData.get("linkTargetType") ?? "") || undefined;
  const linkTargetId = String(formData.get("linkTargetId") ?? "") || pageId || undefined;
  const contextMode = (String(formData.get("contextMode") ?? "prompt_only") ||
    "prompt_only") as ImageStudioPromptContextMode;
  const contextSnippet = String(formData.get("contextSnippet") ?? "") || undefined;
  const variantCountRaw = Number.parseInt(String(formData.get("variantCount") ?? "1"), 10);
  const variantCount = task === "variant"
    ? Math.min(4, Math.max(1, Number.isFinite(variantCountRaw) ? variantCountRaw : 1))
    : 1;

  assertStudioCanUseAI();
  await requireStudioWorldEdit(worldSlug);

  if ((task === "inpaint" || task === "edit" || task === "remove_background") && !sourceImageBase64) {
    throw new Error("Quellbild ist für diese Operation erforderlich.");
  }
  if (task === "inpaint" && !maskBase64) {
    throw new Error("Maske ist für Inpainting erforderlich.");
  }

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) throw new Error("Welt nicht gefunden.");

  const imageStudio = createImageStudioService(prisma);
  let project;
  if (existingProjectId) {
    project = await imageStudio.getProject(existingProjectId);
    if (!project) throw new Error("Projekt nicht gefunden.");
    await imageStudio.saveDraft({
      projectId: existingProjectId,
      prompt,
      title: title ?? project.title,
    });
    await imageStudio.updateProjectStatus(existingProjectId, "processing");
  } else {
    project = await imageStudio.createProject({
      worldId: world.id,
      title: title ?? `Image Studio — ${task}`,
      prompt,
      metadata: { contextMode, reviewStatus: "draft" },
    });
    await imageStudio.updateProjectStatus(project.id, "processing");
  }

  const projectId = project.id;

  const resolvedLinkType = (linkTargetType ?? (pageId ? "page" : undefined)) as
    | ImageStudioLinkTargetType
    | undefined;

  if (resolvedLinkType && linkTargetId) {
    await imageStudio.linkProject(projectId, resolvedLinkType, linkTargetId);
  }

  const jobs = createJobService(prisma);
  for (let index = 0; index < variantCount; index += 1) {
    const variantTitle = variantCount > 1 ? `${title ?? task} (${index + 1}/${variantCount})` : title;
    const job = await jobs.enqueue({
      type: "image_studio",
      title: variantCount > 1 ? `Image Studio: ${task} ${index + 1}/${variantCount}` : `Image Studio: ${task}`,
      worldId: world.id,
      worldSlug: world.slug,
      payload: {
        projectId,
        worldId: world.id,
        worldSlug: world.slug,
        task,
        prompt,
        title: variantTitle,
        sourceImageBase64,
        maskBase64,
        contextMode,
        contextSnippet,
      },
      relatedType: "image_studio_project",
      relatedId: projectId,
    });
    void dispatchJob(job.id);
  }
  revalidatePath("/image-studio");
  if (existingProjectId) {
    revalidatePath(`/image-studio/${existingProjectId}`);
    redirect(`/image-studio/${existingProjectId}`);
  }
}

export async function retryImageStudioProjectAction(formData: FormData) {
  await requireStudioAiActionAuth();
  const settings = await getSystemSettings();
  if (!settings.imageStudio.enabled) throw new Error("Image Studio ist deaktiviert.");

  assertStudioCanUseAI();

  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) throw new Error("projectId fehlt.");

  const imageStudio = createImageStudioService(prisma);
  const project = await imageStudio.getProject(projectId);
  if (!project) throw new Error("Projekt nicht gefunden.");

  const world = project.worldId
    ? await prisma.world.findUnique({ where: { id: project.worldId }, select: { slug: true } })
    : null;
  if (world?.slug) {
    await requireStudioWorldEdit(world.slug);
  }

  const jobs = createJobService(prisma);
  const failedJob = await prisma.job.findFirst({
    where: {
      relatedType: "image_studio_project",
      relatedId: projectId,
      status: "failed",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!failedJob) {
    throw new Error("Kein fehlgeschlagener Job für dieses Projekt gefunden.");
  }

  const retried = await jobs.retry(failedJob.id);
  if (!retried) {
    throw new Error("Job konnte nicht wiederholt werden.");
  }

  await imageStudio.updateProjectStatus(projectId, "processing");
  void dispatchJob(retried.id);
  revalidatePath("/image-studio");
  revalidatePath(`/image-studio/${projectId}`);
}

export async function saveImageStudioDraftAction(formData: FormData) {
  await requireStudioAiActionAuth();
  const settings = await getSystemSettings();
  if (!settings.imageStudio.enabled) throw new Error("Image Studio ist deaktiviert.");

  assertStudioCanUseAI();

  const projectId = String(formData.get("projectId") ?? "");
  const prompt = String(formData.get("prompt") ?? "") || undefined;
  const title = String(formData.get("title") ?? "") || undefined;

  if (!projectId) throw new Error("projectId fehlt.");

  const imageStudio = createImageStudioService(prisma);
  await imageStudio.saveDraft({ projectId, prompt, title });
  revalidatePath("/image-studio");
}

export async function adoptImageStudioAssetAction(formData: FormData) {
  await requireStudioActionAuth();

  const assetId = String(formData.get("assetId") ?? "");
  const targetType = String(formData.get("targetType") ?? "") as
    | "page"
    | "workshop_project"
    | "capture"
    | "hardware_device"
    | "contract_expense";
  const targetId = String(formData.get("targetId") ?? "");
  const contentBlockId = String(formData.get("contentBlockId") ?? "") || undefined;
  const worldSlug = String(formData.get("worldSlug") ?? "");

  if (!assetId || !targetType || !targetId) {
    throw new Error("assetId, targetType und targetId sind erforderlich.");
  }

  if (worldSlug) {
    await requireStudioWorldEdit(worldSlug);
  }

  await adoptAssetToTarget(prisma, brainPrisma, {
    assetId,
    targetType,
    targetId,
    relationType: "adopted",
    contentBlockId,
  });

  revalidatePath("/image-studio");
  if (worldSlug) {
    revalidatePath(`/worlds/${worldSlug}/assets`);
  }
}

export async function saveImageStudioCanvasAction(formData: FormData) {
  await requireStudioActionAuth();

  const projectId = String(formData.get("projectId") ?? "");
  const imageBase64 = String(formData.get("imageBase64") ?? "");
  const title = String(formData.get("title") ?? "") || "Canvas-Bearbeitung";

  if (!projectId || !imageBase64) {
    throw new Error("projectId und imageBase64 sind erforderlich.");
  }

  const imageStudio = createImageStudioService(prisma);
  const project = await imageStudio.getProject(projectId);
  if (!project?.worldId) {
    throw new Error("Projekt oder Welt nicht gefunden.");
  }

  const world = await prisma.world.findUnique({
    where: { id: project.worldId },
    select: { slug: true },
  });
  if (!world) {
    throw new Error("Welt nicht gefunden.");
  }
  await requireStudioWorldEdit(world.slug);

  // Ablage-Sequenz zentral in storeUploadedAsset (schreibt + Audit).
  const asset = await storeUploadedAsset(prisma, {
    worldId: project.worldId,
    buffer: Buffer.from(imageBase64, "base64"),
    title,
    type: "image",
    storage: {
      storageKey: buildStorageKey(project.worldId, "image-studio-canvas.png"),
      mimeType: "image/png",
    },
    metadata: { source: "image_studio_canvas", projectId },
    audit: { source: "image_studio_canvas", projectId },
  });

  await imageStudio.addVersion({
    projectId,
    operation: "edit",
    prompt: project.prompt,
    assetId: asset.id,
    providerMode: "manual",
    metadata: { reviewStatus: "draft", editor: "canvas" },
  });

  await syncImageStudioProjectLinksToAsset(prisma, brainPrisma, projectId, asset.id);
  await imageStudio.updateProjectStatus(projectId, "completed");

  revalidatePath("/image-studio");
  revalidatePath(`/image-studio/${projectId}`);
  revalidatePath(`/image-studio/${projectId}/edit`);
}

export async function addDndBeyondReferenceAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug") ?? "");
  const url = String(formData.get("url") ?? "");
  if (!url.includes("dndbeyond.com")) {
    throw new Error("Nur D&D Beyond Links — kein Scraping.");
  }

  await requireStudioWorldEdit(worldSlug);

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) throw new Error("Welt nicht gefunden.");

  const dndApi = createDndApiService(prisma);
  await dndApi.createBeyondReference({
    worldId: world.id,
    title: String(formData.get("title") ?? ""),
    url,
    entityType: String(formData.get("entityType") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
  });
  revalidatePath(`/worlds/${worldSlug}/dnd-api`);
}
