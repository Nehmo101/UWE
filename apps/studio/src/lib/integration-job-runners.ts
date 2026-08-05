import fs from "node:fs";
import {
  buildStorageKey,
  ensureUploadDirectory,
  resolveAssetFilePath,
} from "@uwe/assets";
import {
  createCalendarService,
  createImageStudioService,
  createPrismaClient,
  createResearchService,
  createUweRepositoryFromClient,
  getSystemSettings,
  resolveEffectiveUploadsPath,
  syncImageStudioProjectLinksToAsset,
  type JobService,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { familyPrisma } from "@uwe/database/family-client";
import { fetchIcalFeed, parseIcalEvents, syncCalDavCollection } from "@uwe/calendar";
import {
  executeAiGatewayImageRequest,
  executeAiGatewayResearchJob,
  AiGatewayAccessDeniedError,
} from "@uwe/ai-brain";
import type { ImageStudioTask } from "@uwe/image-studio";
import type { ImageStudioPromptContextMode } from "@uwe/image-studio";
import { appendResearchSources } from "@uwe/ai-brain";
import { buildResearchReport, resolveSearxngUrl, searchSearxng } from "@uwe/web-search";
import { syncMailAccount } from "@uwe/mail/sync-account";
import type { JobRunnerContext } from "./job-runners";
import { resolveGatewayUserById } from "./ai-gateway-user";
import { synthesizeResearchReportViaGateway } from "./research-synthesis";

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
    await ctx.jobs.updateProgress(ctx.jobId, 10, "Maschinenraum-Host anfragen");
    await assertNotCancelled(ctx.jobs, ctx.jobId);

    const result = await executeAiGatewayImageRequest({
      user: gatewayUser,
      feature: "AI_IMAGE_USE",
      task: payload.task,
      prompt: payload.prompt,
      sourceImageBase64: payload.sourceImageBase64,
      maskBase64: payload.maskBase64,
      contextMode: payload.contextMode,
      contextSnippet: payload.contextSnippet,
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

    await syncImageStudioProjectLinksToAsset(db, brainPrisma, activeProjectId, asset.id);

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

export async function runMailSyncJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as {
    accountId?: string;
    limit?: number;
    fullSync?: boolean;
    mailbox?: string;
  };
  if (!payload.accountId) {
    throw new Error("Mail-Sync: accountId fehlt.");
  }

  // Der Sync selbst liegt in @uwe/mail — Brain ruft dieselbe Funktion direkt
  // auf. Hier bleibt nur, was den Job ausmacht: Fortschritt melden und auf
  // Abbruch prüfen.
  const result = await syncMailAccount(brainPrisma, payload.accountId, {
    limit: payload.limit ?? 50,
    fullSync: payload.fullSync ?? false,
    mailbox: payload.mailbox,
    onProgress: async (percent, phase) => {
      await ctx.jobs.updateProgress(ctx.jobId, percent, phase);
      await assertNotCancelled(ctx.jobs, ctx.jobId);
    },
  });
  return { ...result };
}

export async function runResearchJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as { sessionId?: string };
  if (!payload.sessionId) {
    throw new Error("Research-Job: sessionId fehlt.");
  }

  const db = createPrismaClient();
  const research = createResearchService(brainPrisma);
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

        await ctx.jobs.updateProgress(ctx.jobId, 55, "KI-Synthese erstellen");
        await assertNotCancelled(ctx.jobs, ctx.jobId);

        // LLM synthesis with brain context; on failure (Maschinenraum offline, permission,
        // budget) the plain source list stays available as fallback report.
        let reportMd: string;
        let synthesized = false;
        try {
          const synthesis = await synthesizeResearchReportViaGateway(db, {
            user: gatewayUser,
            query: session.query,
            results,
            contextMode: session.contextMode as "dnd_brain" | "life_brain" | "open_web",
            worldId: session.worldId,
            useMock: process.env.AI_USE_MOCK === "true",
          });
          reportMd = appendResearchSources(synthesis, results);
          synthesized = true;
        } catch (synthesisError) {
          const reason =
            synthesisError instanceof Error ? synthesisError.message : String(synthesisError);
          reportMd = [
            buildResearchReport(session.query, results),
            "",
            `> KI-Synthese nicht verfügbar: ${reason}`,
          ].join("\n");
        }

        await ctx.jobs.updateProgress(ctx.jobId, 85, "Report speichern");
        await research.complete(
          session.id,
          reportMd,
          results.map((result) => ({
            url: result.url,
            title: result.title,
            snippet: result.snippet,
          })),
        );

        return { sourceCount: results.length, synthesized };
      },
    );

    await db.$disconnect();
    return {
      sessionId: session.id,
      sourceCount: researchResult.sourceCount,
      synthesized: researchResult.synthesized,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await research.fail(session.id, message);
    await db.$disconnect();
    throw error;
  }
}

export async function runBriefingJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const gatewayUser = await resolveGatewayUserById(ctx.job.userId);
  if (!gatewayUser) {
    throw new AiGatewayAccessDeniedError(
      "Authentifizierung erforderlich für das Morning Briefing (job.userId fehlt).",
    );
  }

  const db = createPrismaClient();
  try {
    await ctx.jobs.updateProgress(ctx.jobId, 20, "Fakten & News sammeln");
    await assertNotCancelled(ctx.jobs, ctx.jobId);

    const { generateMorningBriefing } = await import("./morning-briefing");
    await ctx.jobs.updateProgress(ctx.jobId, 50, "Briefing erstellen");
    const result = await generateMorningBriefing(db, gatewayUser);

    return {
      documentId: result.documentId,
      title: result.title,
      newsCount: result.newsCount,
    };
  } finally {
    await db.$disconnect();
  }
}

export async function runCalendarSyncJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as { feedId?: string; worldId?: string };
  if (!payload.feedId) {
    throw new Error("Kalender-Sync: feedId fehlt.");
  }

  const db = createPrismaClient();
  const calendar = createCalendarService(familyPrisma, db);
  const feed = await calendar.getFeed(payload.feedId);
  if (!feed) {
    await db.$disconnect();
    throw new Error("Kalender-Feed nicht gefunden.");
  }

  await ctx.jobs.updateProgress(ctx.jobId, 10, `Sync: ${feed.name}`);
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  try {
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

    const contractSync = await calendar.syncContractDeadlinesToCalendar();

    await calendar.markFeedSynced(feed.id, null);
    await db.$disconnect();
    return {
      feedId: feed.id,
      imported,
      sessionsSynced,
      contractDeadlinesSynced: contractSync.synced,
      pruned,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await calendar.markFeedSynced(feed.id, message);
    await db.$disconnect();
    throw error;
  }
}
