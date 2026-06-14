import fs from "node:fs";
import {
  buildStorageKey,
  ensureUploadDirectory,
  resolveAssetFilePath,
} from "@uwe/assets";
import {
  createCalendarService,
  createDevAgentJobService,
  createImageStudioService,
  createPrismaClient,
  createUweRepositoryFromClient,
  getSystemSettings,
  resolveEffectiveUploadsPath,
  type JobService,
} from "@uwe/database/server";
import { dispatchAgentJob, resolveAgentJobsDispatchConfig } from "@uwe/agent-jobs";
import { fetchCalDavEvents, fetchIcalFeed, parseIcalEvents } from "@uwe/calendar";
import { runImageStudioTask, type ImageStudioTask } from "@uwe/image-studio";
import type { JobRunnerContext } from "./job-runners";

async function assertNotCancelled(jobs: JobService, jobId: string): Promise<void> {
  if (await jobs.isCancelled(jobId)) {
    throw new Error("Job wurde abgebrochen.");
  }
}

export async function runImageStudioJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as {
    projectId?: string;
    worldId?: string;
    worldSlug?: string;
    task?: ImageStudioTask;
    prompt?: string;
    providerMode?: string;
    sourceImageBase64?: string;
    maskBase64?: string;
    title?: string;
  };

  if (!payload.prompt || !payload.task) {
    throw new Error("Image-Studio-Job: prompt und task sind erforderlich.");
  }

  await ctx.jobs.updateProgress(ctx.jobId, 10, "Provider auswählen");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const result = await runImageStudioTask({
    task: payload.task,
    prompt: payload.prompt,
    providerMode: payload.providerMode as "auto" | "local_rtx" | "cloud" | undefined,
    sourceImageBase64: payload.sourceImageBase64,
    maskBase64: payload.maskBase64,
  });

  if (!result.success || !result.imageBase64) {
    throw new Error(result.error ?? "Bildgenerierung fehlgeschlagen.");
  }

  await ctx.jobs.updateProgress(ctx.jobId, 60, "Bild speichern");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const db = createPrismaClient();
  const imageStudio = createImageStudioService(db);
  const repo = createUweRepositoryFromClient(db);

  let projectId = payload.projectId;
  if (!projectId && payload.worldId) {
    const project = await imageStudio.createProject({
      worldId: payload.worldId,
      title: payload.title ?? `Image Studio ${new Date().toLocaleString("de-DE")}`,
      prompt: payload.prompt,
    });
    projectId = project.id;
  }

  if (!projectId || !payload.worldId) {
    await db.$disconnect();
    return { imageBase64Length: result.imageBase64.length, provider: result.providerUsed };
  }

  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);
  ensureUploadDirectory(payload.worldId, undefined, uploadsRoot);
  const storageKey = buildStorageKey(payload.worldId, "image-studio.png");
  const filePath = resolveAssetFilePath(storageKey, undefined, uploadsRoot);
  fs.writeFileSync(filePath, Buffer.from(result.imageBase64, "base64"));

  const asset = await repo.createAsset({
    worldId: payload.worldId,
    title: payload.title ?? `Image Studio — ${payload.task}`,
    type: "image",
    storageKey,
    mimeType: result.mimeType ?? "image/png",
    size: Buffer.byteLength(result.imageBase64, "base64"),
    visibility: "dm_only",
    metadata: { source: "image_studio", task: payload.task, provider: result.providerUsed },
  });

  const version = await imageStudio.addVersion({
    projectId,
    operation: payload.task,
    prompt: payload.prompt,
    assetId: asset.id,
    providerMode: result.providerUsed,
  });

  await imageStudio.updateProjectStatus(projectId, "completed");
  await db.$disconnect();

  return {
    projectId,
    versionId: version.id,
    assetId: asset.id,
    provider: result.providerUsed,
    worldSlug: payload.worldSlug,
  };
}

export async function runAgentJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as { devAgentJobId?: string };
  if (!payload.devAgentJobId) {
    throw new Error("Agent-Job: devAgentJobId fehlt.");
  }

  const db = createPrismaClient();
  const agentJobs = createDevAgentJobService(db);
  const job = await agentJobs.getJob(payload.devAgentJobId);
  if (!job) {
    await db.$disconnect();
    throw new Error("DevAgentJob nicht gefunden.");
  }

  await agentJobs.updateJob(job.id, { status: "dispatched" });
  await ctx.jobs.updateProgress(ctx.jobId, 30, "Agent dispatch");

  const dispatch = await dispatchAgentJob(
    {
      jobId: job.id,
      title: job.title,
      prompt: job.prompt,
      provider: job.provider,
    },
    resolveAgentJobsDispatchConfig(),
  );

  if (!dispatch.success) {
    await agentJobs.updateJob(job.id, {
      status: "failed",
      errorMessage: dispatch.error ?? "Dispatch fehlgeschlagen",
      completedAt: new Date(),
    });
    await db.$disconnect();
    throw new Error(dispatch.error ?? "Agent dispatch fehlgeschlagen.");
  }

  await agentJobs.updateJob(job.id, {
    status: "running",
    branchName: dispatch.branchName ?? null,
    githubRunId: dispatch.githubRunId ?? null,
    cursorJobId: dispatch.cursorJobId ?? null,
  });

  await db.$disconnect();
  return {
    devAgentJobId: job.id,
    branchName: dispatch.branchName,
    githubRunId: dispatch.githubRunId,
    cursorJobId: dispatch.cursorJobId,
  };
}

export async function runCalendarSyncJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as { feedId?: string };
  if (!payload.feedId) {
    throw new Error("Kalender-Sync: feedId fehlt.");
  }

  const db = createPrismaClient();
  const calendar = createCalendarService(db);
  const feed = await calendar.getFeed(payload.feedId);
  if (!feed) {
    await db.$disconnect();
    throw new Error("Kalender-Feed nicht gefunden.");
  }

  await ctx.jobs.updateProgress(ctx.jobId, 20, `Sync: ${feed.name}`);
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  try {
    let events;
    if (feed.type === "caldav" && feed.caldavUrl) {
      events = await fetchCalDavEvents({
        caldavUrl: feed.caldavUrl,
        username: feed.username ?? undefined,
        password: process.env.CALDAV_PASSWORD?.trim(),
      });
    } else if (feed.url) {
      const content = await fetchIcalFeed(feed.url);
      events = parseIcalEvents(content);
    } else {
      throw new Error("Feed hat weder URL noch CalDAV-URL.");
    }

    let imported = 0;
    for (const event of events) {
      await calendar.upsertExternalEvent(feed.id, event.uid, {
        feedId: feed.id,
        title: event.title,
        description: event.description ?? null,
        location: event.location ?? null,
        startAt: event.startAt,
        endAt: event.endAt ?? null,
        allDay: event.allDay,
        kind: feed.type === "familywall" ? "personal" : "external",
        externalUid: event.uid,
      });
      imported += 1;
    }

    await calendar.markFeedSynced(feed.id, null);
    await db.$disconnect();
    return { feedId: feed.id, imported };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await calendar.markFeedSynced(feed.id, message);
    await db.$disconnect();
    throw error;
  }
}
