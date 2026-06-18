"use server";

import { revalidatePath } from "next/cache";
import {
  createCalendarService,
  createDevAgentJobService,
  createDndApiService,
  createImageStudioService,
  createJobService,
  getAppRepository,
  prisma,
  resolveAgentJobsConfig,
  resolveImageStudioConfig,
} from "@uwe/database/server";
import { dispatchJob } from "@/src/lib/job-executor";
import {
  assertStudioCanUseAI,
  assertStudioTrusted,
  requireStudioWorldEdit,
} from "@/src/lib/authz";

export async function createImageStudioJobAction(formData: FormData) {
  const config = resolveImageStudioConfig();
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
  const variantCountRaw = Number.parseInt(String(formData.get("variantCount") ?? "1"), 10);
  const variantCount = task === "variant"
    ? Math.min(4, Math.max(1, Number.isFinite(variantCountRaw) ? variantCountRaw : 1))
    : 1;

  assertStudioCanUseAI();
  await requireStudioWorldEdit(worldSlug);

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) throw new Error("Welt nicht gefunden.");

  const imageStudio = createImageStudioService(prisma);
  const project = await imageStudio.createProject({
    worldId: world.id,
    title: title ?? `Image Studio — ${task}`,
    prompt,
  });

  if (pageId && (linkTargetType === "page" || !linkTargetType)) {
    await imageStudio.linkProject(project.id, "page", pageId);
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
      },
      relatedType: "image_studio_project",
      relatedId: project.id,
    });
    void dispatchJob(job.id);
  }
  revalidatePath("/image-studio");
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
  assertStudioTrusted();

  const calendar = createCalendarService(prisma);
  const type = String(formData.get("type") ?? "ical_url") as
    | "caldav"
    | "ical_url"
    | "familywall";
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
