"use server";

import fs from "node:fs";
import { revalidatePath } from "next/cache";
import {
  buildStorageKey,
  ensureUploadDirectory,
  resolveAssetFilePath,
} from "@uwe/assets";
import {
  adoptAssetToTarget,
  createCalendarService,
  createDevAgentJobService,
  createDndApiService,
  createImageStudioService,
  createJobService,
  createUweRepositoryFromClient,
  getAppRepository,
  getSystemSettings,
  prisma,
  resolveAgentJobsConfig,
  resolveCalendarConfig,
  resolveEffectiveUploadsPath,
  syncImageStudioProjectLinksToAsset,
} from "@uwe/database/server";
import type { ImageStudioLinkTargetType } from "@uwe/database/server";
import type { ImageStudioPromptContextMode } from "@uwe/image-studio";
import { validateImageContextForProvider } from "@uwe/image-studio";
import { dispatchJob } from "@/src/lib/job-executor";
import {
  assertStudioCanUseAI,
  assertStudioTrusted,
  requireStudioWorldEdit,
} from "@/src/lib/authz";

export async function createImageStudioJobAction(formData: FormData) {
  const settings = await getSystemSettings();
  const config = {
    enabled: settings.imageStudio.enabled,
    defaultProviderMode: settings.imageStudio.defaultProviderMode,
    allowCloud: settings.imageStudio.allowCloud,
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
  const providerMode = String(formData.get("providerMode") ?? "") || undefined;
  const sourceImageBase64 = String(formData.get("sourceImageBase64") ?? "") || undefined;
  const maskBase64 = String(formData.get("maskBase64") ?? "") || undefined;
  const pageId = String(formData.get("pageId") ?? "") || undefined;
  const linkTargetType = String(formData.get("linkTargetType") ?? "") || undefined;
  const linkTargetId = String(formData.get("linkTargetId") ?? "") || pageId || undefined;
  const contextMode = (String(formData.get("contextMode") ?? "prompt_only") ||
    "prompt_only") as ImageStudioPromptContextMode;
  const contextSnippet = String(formData.get("contextSnippet") ?? "") || undefined;
  const cloudContextApproved = formData.get("cloudContextApproved") === "on";
  const variantCountRaw = Number.parseInt(String(formData.get("variantCount") ?? "1"), 10);
  const variantCount = task === "variant"
    ? Math.min(4, Math.max(1, Number.isFinite(variantCountRaw) ? variantCountRaw : 1))
    : 1;

  assertStudioCanUseAI();
  await requireStudioWorldEdit(worldSlug);

  const effectiveProvider = (providerMode as "auto" | "local_rtx" | "cloud" | undefined) ?? "auto";
  if ((task === "inpaint" || task === "edit" || task === "remove_background") && !sourceImageBase64) {
    throw new Error("Quellbild ist für diese Operation erforderlich.");
  }
  if (task === "inpaint" && !maskBase64) {
    throw new Error("Maske ist für Inpainting erforderlich.");
  }
  if (
    (task === "inpaint" || task === "edit" || task === "remove_background") &&
    (effectiveProvider === "cloud" || (effectiveProvider === "auto" && config.allowCloud))
  ) {
    throw new Error("Inpaint/Edit ist nur mit lokalem RTX verfügbar.");
  }

  if (effectiveProvider === "cloud" || (effectiveProvider === "auto" && config.allowCloud)) {
    validateImageContextForProvider("cloud", contextMode, { cloudContextApproved });
  }

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) throw new Error("Welt nicht gefunden.");

  const imageStudio = createImageStudioService(prisma);
  const project = await imageStudio.createProject({
    worldId: world.id,
    title: title ?? `Image Studio — ${task}`,
    prompt,
    metadata: { contextMode, reviewStatus: "draft" },
  });

  const resolvedLinkType = (linkTargetType ?? (pageId ? "page" : undefined)) as
    | ImageStudioLinkTargetType
    | undefined;

  if (resolvedLinkType && linkTargetId) {
    await imageStudio.linkProject(project.id, resolvedLinkType, linkTargetId);
  }

  await imageStudio.updateProjectStatus(project.id, "processing");

  const jobs = createJobService(prisma);
  for (let index = 0; index < variantCount; index += 1) {
    const variantTitle = variantCount > 1 ? `${title ?? task} (${index + 1}/${variantCount})` : title;
    const job = await jobs.enqueue({
      type: "image_studio",
      title: variantCount > 1 ? `Image Studio: ${task} ${index + 1}/${variantCount}` : `Image Studio: ${task}`,
      worldId: world.id,
      worldSlug: world.slug,
      payload: {
        projectId: project.id,
        worldId: world.id,
        worldSlug: world.slug,
        task,
        prompt,
        providerMode,
        title: variantTitle,
        sourceImageBase64,
        maskBase64,
        contextMode,
        contextSnippet,
        cloudContextApproved,
      },
      relatedType: "image_studio_project",
      relatedId: project.id,
    });
    void dispatchJob(job.id);
  }
  revalidatePath("/image-studio");
}

export async function saveImageStudioDraftAction(formData: FormData) {
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
  assertStudioTrusted();

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

  await adoptAssetToTarget(prisma, {
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
  assertStudioTrusted();

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

  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);
  ensureUploadDirectory(project.worldId, undefined, uploadsRoot);
  const storageKey = buildStorageKey(project.worldId, "image-studio-canvas.png");
  const filePath = resolveAssetFilePath(storageKey, undefined, uploadsRoot);
  fs.writeFileSync(filePath, Buffer.from(imageBase64, "base64"));

  const repo = createUweRepositoryFromClient(prisma);
  const asset = await repo.createAsset({
    worldId: project.worldId,
    title,
    type: "image",
    storageKey,
    mimeType: "image/png",
    size: Buffer.byteLength(imageBase64, "base64"),
    visibility: "dm_only",
    metadata: { source: "image_studio_canvas", projectId },
  });

  await imageStudio.addVersion({
    projectId,
    operation: "edit",
    prompt: project.prompt,
    assetId: asset.id,
    providerMode: "manual",
    metadata: { reviewStatus: "draft", editor: "canvas" },
  });

  await syncImageStudioProjectLinksToAsset(prisma, projectId, asset.id);
  await imageStudio.updateProjectStatus(projectId, "completed");

  revalidatePath("/image-studio");
  revalidatePath(`/image-studio/${projectId}`);
  revalidatePath(`/image-studio/${projectId}/edit`);
}

export async function createAgentJobAction(formData: FormData) {
  const config = resolveAgentJobsConfig();
  if (!config.enabled) throw new Error("Agent Jobs sind deaktiviert.");

  assertStudioTrusted();
  assertStudioCanUseAI();

  const title = String(formData.get("title") ?? "");
  const prompt = String(formData.get("prompt") ?? "");
  const provider = String(formData.get("provider") ?? config.defaultProvider) as
    | "github_actions"
    | "cursor_cloud"
    | "cursor_cli_local";

  const agentJobs = createDevAgentJobService(prisma);
  const devJob = await agentJobs.createJob({ title, prompt, provider });

  const jobs = createJobService(prisma);
  const queueJob = await jobs.enqueue({
    type: "agent_job",
    title: `Agent: ${devJob.title}`,
    payload: { devAgentJobId: devJob.id },
    relatedType: "dev_agent_job",
    relatedId: devJob.id,
  });
  void dispatchJob(queueJob.id);
  revalidatePath("/admin/agent-jobs");
}

export async function createCalendarEventAction(formData: FormData) {
  const calConfig = resolveCalendarConfig();
  if (!calConfig.enabled) throw new Error("Kalender ist deaktiviert.");

  assertStudioTrusted();

  const calendar = createCalendarService(prisma);
  const feedIdInput = String(formData.get("feedId") ?? "");
  const localFeed = await calendar.ensureLocalFeed();
  const feedId = feedIdInput || localFeed.id;

  const event = await calendar.createEvent({
    feedId,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? "") || null,
    startAt: new Date(String(formData.get("startAt") ?? "")),
    endAt: formData.get("endAt") ? new Date(String(formData.get("endAt"))) : null,
    allDay: formData.get("allDay") === "on",
    kind: (String(formData.get("kind") ?? "personal") as "session" | "prep" | "personal" | "dnd"),
    worldId: String(formData.get("worldId") ?? "") || null,
  });

  const feed = await calendar.getFeed(feedId);
  if (feed?.type === "caldav" && feed.direction === "read_write") {
    await calendar.markEventPendingWrite(event.id);
    const jobs = createJobService(prisma);
    const job = await jobs.enqueue({
      type: "calendar_sync",
      title: `Kalender-Sync: ${feed.name}`,
      payload: { feedId: feed.id },
    });
    void dispatchJob(job.id);
  }

  revalidatePath("/calendar");
}

export async function createCalendarFeedAction(formData: FormData) {
  const calConfig = resolveCalendarConfig();
  if (!calConfig.enabled) throw new Error("Kalender ist deaktiviert.");

  assertStudioTrusted();

  const type = String(formData.get("type") ?? "ical_url") as
    | "caldav"
    | "ical_url"
    | "familywall";
  if (type === "caldav" && !calConfig.caldavEnabled) {
    throw new Error("CalDAV ist deaktiviert. Setze CALENDAR_CALDAV_ENABLED=true.");
  }
  if (type === "familywall" && !calConfig.familywallEnabled) {
    throw new Error("FamilyWall-Feeds sind deaktiviert.");
  }

  const calendar = createCalendarService(prisma);
  const readWrite = formData.get("readWrite") === "on";
  const feed = await calendar.createFeed({
    name: String(formData.get("name") ?? ""),
    type,
    url: String(formData.get("url") ?? "") || null,
    caldavUrl: String(formData.get("caldavUrl") ?? "") || null,
    username: String(formData.get("username") ?? "") || null,
    password: String(formData.get("password") ?? "") || null,
    direction: type === "caldav" && readWrite ? "read_write" : "read_only",
  });

  const jobs = createJobService(prisma);
  const job = await jobs.enqueue({
    type: "calendar_sync",
    title: `Kalender-Sync: ${feed.name}`,
    payload: { feedId: feed.id },
  });
  void dispatchJob(job.id);
  revalidatePath("/calendar");
}

export async function addDndBeyondReferenceAction(formData: FormData) {
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
