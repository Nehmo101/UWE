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
  createMailAccountService,
  createPrismaClient,
  createResearchService,
  createUweRepositoryFromClient,
  getSystemSettings,
  resolveEffectiveUploadsPath,
  syncImageStudioProjectLinksToAsset,
  type JobService,
} from "@uwe/database/server";
import { dispatchAgentJob, resolveAgentJobsDispatchConfig } from "@uwe/agent-jobs";
import { fetchIcalFeed, parseIcalEvents, putCalDavEvent, syncCalDavCollection } from "@uwe/calendar";
import {
  executeAiGatewayImageRequest,
  executeAiGatewayResearchJob,
  AiGatewayAccessDeniedError,
} from "@uwe/ai-brain";
import type { ImageStudioTask } from "@uwe/image-studio";
import type { ImageStudioPromptContextMode } from "@uwe/image-studio";
import { buildResearchReport, resolveSearxngUrl, searchSearxng } from "@uwe/web-search";
import type { JobRunnerContext } from "./job-runners";
import { resolveGatewayUserById } from "./ai-gateway-user";

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
    contextMode?: ImageStudioPromptContextMode;
    contextSnippet?: string;
    cloudContextApproved?: boolean;
  };

  if (!payload.prompt || !payload.task) {
    throw new Error("Image-Studio-Job: prompt und task sind erforderlich.");
  }

  const gatewayUser = await resolveGatewayUserById(ctx.job.userId);
  if (!gatewayUser) {
    throw new AiGatewayAccessDeniedError(
      "Authentifizierung erforderlich für Image Studio (job.userId fehlt).",
    );
  }

  const db = createPrismaClient();
  const imageStudio = createImageStudioService(db);
  let activeProjectId = payload.projectId;

  try {
    await ctx.jobs.updateProgress(ctx.jobId, 10, "Provider auswählen");
    await assertNotCancelled(ctx.jobs, ctx.jobId);

    const result = await executeAiGatewayImageRequest({
      user: gatewayUser,
      feature: "AI_IMAGE_USE",
      task: payload.task,
      prompt: payload.prompt,
      providerMode: payload.providerMode as "auto" | "local_rtx" | "cloud" | undefined,
      sourceImageBase64: payload.sourceImageBase64,
      maskBase64: payload.maskBase64,
      contextMode: payload.contextMode,
      contextSnippet: payload.contextSnippet,
      cloudContextApproved: payload.cloudContextApproved,
    });

    if (!result.success || !result.imageBase64) {
      throw new Error(result.error ?? "Bildgenerierung fehlgeschlagen.");
    }

    await ctx.jobs.updateProgress(ctx.jobId, 60, "Bild speichern");
    await assertNotCancelled(ctx.jobs, ctx.jobId);

    const repo = createUweRepositoryFromClient(db);

    if (!activeProjectId && payload.worldId) {
      const project = await imageStudio.createProject({
        worldId: payload.worldId,
        title: payload.title ?? `Image Studio ${new Date().toLocaleString("de-DE")}`,
        prompt: payload.prompt,
      });
      activeProjectId = project.id;
    }

    if (!activeProjectId || !payload.worldId) {
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
      projectId: activeProjectId,
      operation: payload.task,
      prompt: payload.prompt,
      assetId: asset.id,
      providerMode: result.providerUsed,
      metadata: {
        reviewStatus: "draft",
        contextMode: payload.contextMode ?? "prompt_only",
      },
    });

    await syncImageStudioProjectLinksToAsset(db, activeProjectId, asset.id);

    await imageStudio.updateProjectStatus(activeProjectId, "completed");

    return {
      projectId: activeProjectId,
      versionId: version.id,
      assetId: asset.id,
      provider: result.providerUsed,
      worldSlug: payload.worldSlug,
    };
  } catch (error) {
    if (activeProjectId && !(await ctx.jobs.isCancelled(ctx.jobId))) {
      const message = error instanceof Error ? error.message : "Bildgenerierung fehlgeschlagen.";
      await imageStudio.markProjectFailed(activeProjectId, message);
    }
    throw error;
  } finally {
    await db.$disconnect();
  }
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
    prUrl: dispatch.prUrl ?? null,
  });

  await db.$disconnect();
  return {
    devAgentJobId: job.id,
    branchName: dispatch.branchName,
    githubRunId: dispatch.githubRunId,
    cursorJobId: dispatch.cursorJobId,
  };
}

export async function runMailSyncJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as { accountId?: string; limit?: number };
  if (!payload.accountId) {
    throw new Error("Mail-Sync: accountId fehlt.");
  }

  const db = createPrismaClient();
  const mail = createMailAccountService(db);

  await ctx.jobs.updateProgress(ctx.jobId, 20, "IMAP Postfach synchronisieren");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  try {
    const result = await mail.syncInbox(payload.accountId, { limit: payload.limit ?? 50 });
    await db.$disconnect();
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await mail.markImapSyncError(payload.accountId, message);
    await db.$disconnect();
    throw error;
  }
}

export async function runResearchJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as { sessionId?: string };
  if (!payload.sessionId) {
    throw new Error("Research-Job: sessionId fehlt.");
  }

  const db = createPrismaClient();
  const research = createResearchService(db);
  const session = await research.get(payload.sessionId);
  if (!session) {
    await db.$disconnect();
    throw new Error("Research-Session nicht gefunden.");
  }

  const gatewayUser = await resolveGatewayUserById(ctx.job.userId);
  if (!gatewayUser) {
    await db.$disconnect();
    throw new AiGatewayAccessDeniedError(
      "Authentifizierung erforderlich für Research (job.userId fehlt).",
    );
  }

  await research.markRunning(session.id);
  await ctx.jobs.updateProgress(ctx.jobId, 20, "Web-Suche starten");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const searxngUrl = resolveSearxngUrl();
  if (!searxngUrl) {
    await research.fail(session.id, "SEARXNG_URL ist nicht konfiguriert.");
    await db.$disconnect();
    throw new Error("SEARXNG_URL ist nicht konfiguriert.");
  }

  try {
    const researchResult = await executeAiGatewayResearchJob(
      {
        user: gatewayUser,
        contextMode: session.contextMode as "dnd_brain" | "life_brain" | "open_web",
        queryChars: session.query.length,
      },
      async () => {
        const results = await searchSearxng({
          baseUrl: searxngUrl,
          query: session.query,
          limit: 8,
        });

        await ctx.jobs.updateProgress(ctx.jobId, 70, "Report erstellen");
        const reportMd = buildResearchReport(session.query, results);
        await research.complete(
          session.id,
          reportMd,
          results.map((result) => ({
            url: result.url,
            title: result.title,
            snippet: result.snippet,
          })),
        );

        return { sourceCount: results.length };
      },
    );

    await db.$disconnect();
    return { sessionId: session.id, sourceCount: researchResult.sourceCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await research.fail(session.id, message);
    await db.$disconnect();
    throw error;
  }
}

export async function runCalendarSyncJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as { feedId?: string; worldId?: string };
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

  await ctx.jobs.updateProgress(ctx.jobId, 10, `Sync: ${feed.name}`);
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  try {
    let pushed = 0;
    if (feed.type === "caldav" && feed.direction !== "read_only" && feed.caldavUrl) {
      const password = calendar.resolveFeedCredentials(feed) ?? process.env.CALDAV_PASSWORD?.trim();
      const pending = await calendar.listPendingWriteBackEvents(feed.id);
      for (const event of pending) {
        const uid = event.externalUid ?? `uwe-event-${event.id}`;
        const result = await putCalDavEvent(
          {
            caldavUrl: feed.caldavUrl,
            username: feed.username ?? undefined,
            password,
          },
          {
            uid,
            title: event.title,
            description: event.description,
            location: event.location,
            startAt: event.startAt,
            endAt: event.endAt,
            allDay: event.allDay,
          },
          event.remoteHref ?? undefined,
          event.remoteEtag ?? undefined,
        );
        await calendar.markEventSynced(event.id, {
          remoteHref: result.href,
          remoteEtag: result.etag,
        });
        pushed += 1;
      }
    }

    await ctx.jobs.updateProgress(ctx.jobId, 40, "Externe Events laden");
    let imported = 0;
    let pruned = 0;
    if (feed.type === "caldav" && feed.caldavUrl) {
      const password = calendar.resolveFeedCredentials(feed) ?? process.env.CALDAV_PASSWORD?.trim();
      const syncResult = await syncCalDavCollection({
        caldavUrl: feed.caldavUrl,
        username: feed.username ?? undefined,
        password,
      });
      for (const event of syncResult.events) {
        await calendar.upsertExternalEvent(feed.id, event.uid, {
          feedId: feed.id,
          title: event.title,
          description: event.description ?? null,
          location: event.location ?? null,
          startAt: event.startAt,
          endAt: event.endAt ?? null,
          allDay: event.allDay,
          kind: "external",
          externalUid: event.uid,
          remoteHref: event.href,
          remoteEtag: event.etag,
        });
        imported += 1;
      }
      await calendar.deleteExternalEventsNotInUids(feed.id, syncResult.remoteUids);
      pruned = syncResult.remoteUids.length > 0 ? 1 : 0;
      await calendar.mergeFeedSyncMetadata(feed.id, {
        syncToken: syncResult.syncToken,
        ctag: syncResult.ctag,
        lastMethod: syncResult.method,
      });
    } else if (feed.url) {
      const content = await fetchIcalFeed(feed.url);
      const events = parseIcalEvents(content);
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
    } else if (feed.type !== "local") {
      throw new Error("Feed hat weder URL noch CalDAV-URL.");
    }

    let sessionsSynced = 0;
    if (payload.worldId) {
      const sessionResult = await calendar.syncAllSessionsForWorld(payload.worldId);
      sessionsSynced = sessionResult.synced;
    }

    await calendar.markFeedSynced(feed.id, null);
    await db.$disconnect();
    return { feedId: feed.id, imported, pushed, sessionsSynced, pruned };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await calendar.markFeedSynced(feed.id, message);
    await db.$disconnect();
    throw error;
  }
}
