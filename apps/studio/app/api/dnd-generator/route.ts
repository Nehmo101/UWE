import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import {
  buildCampaignContext,
  buildDndGeneratorView,
  buildDraftPageContext,
  buildPageContext,
  buildSessionContext,
  buildDungeonRoomContext,
  type DndContextDescriptor,
} from "@uwe/ai-brain";
import { createCampaignCockpitService } from "@uwe/campaign-cockpit";
import {
  createAiRunServiceFromClient,
  createAuthService,
  createPrismaClient,
  createUweRepository,
  prisma,
} from "@uwe/database/server";
import { jsonError } from "@/src/lib/api-response";

async function resolveContext(searchParams: URLSearchParams): Promise<DndContextDescriptor | null> {
  const worldSlug = searchParams.get("worldSlug")?.trim();
  if (!worldSlug) return null;

  const kind = searchParams.get("kind") ?? "page";
  const repo = createUweRepository();

  if (kind === "campaign") {
    const campaignSlug = searchParams.get("campaignSlug")?.trim();
    if (!campaignSlug) return null;

    const campaign = await repo.getCampaignBySlug(worldSlug, campaignSlug);
    if (!campaign) return null;

    return buildCampaignContext({
      worldSlug,
      worldId: campaign.worldId,
      campaignSlug,
      campaignId: campaign.id,
      title: campaign.name,
    });
  }

  if (kind === "session") {
    const sessionId = searchParams.get("sessionId")?.trim();
    if (!sessionId) return null;

    const db = createPrismaClient();
    const auth = createAuthService(db);
    const session = await auth.getGameSessionForDm(worldSlug, sessionId);
    await db.$disconnect();
    if (!session) return null;

    return buildSessionContext({
      worldSlug,
      sessionId,
      title: session.title,
    });
  }

  if (kind === "draft") {
    const pageType = searchParams.get("pageType")?.trim();
    if (!pageType) return null;

    const title = searchParams.get("title")?.trim();
    const world = await repo.getWorldBySlug(worldSlug);

    return buildDraftPageContext({
      worldSlug,
      worldId: world?.id,
      pageType,
      title: title || undefined,
    });
  }

  if (kind === "dungeon_room") {
    const pageSlug = searchParams.get("pageSlug")?.trim();
    const dungeonSlug = searchParams.get("dungeonSlug")?.trim();
    const levelSlug = searchParams.get("levelSlug")?.trim();
    const roomSlug = searchParams.get("roomSlug")?.trim();
    if (!pageSlug || !dungeonSlug || !levelSlug || !roomSlug) return null;

    const page = await repo.getPageBySlug(worldSlug, pageSlug);
    if (!page) return null;

    return buildDungeonRoomContext({
      worldSlug,
      pageSlug,
      pageId: page.id,
      title: page.title,
      dungeonSlug,
      levelSlug,
      roomSlug,
    });
  }

  const pageSlug = searchParams.get("pageSlug")?.trim();
  if (!pageSlug) return null;

  const page = await repo.getPageBySlug(worldSlug, pageSlug);
  if (!page) return null;

  return buildPageContext({
    worldSlug,
    pageSlug,
    pageId: page.id,
    pageType: page.type,
    title: page.title,
  });
}

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const context = await resolveContext(searchParams);
  if (!context) {
    return jsonError("Kontextparameter fehlen oder ungültig.", 400);
  }

  const repo = createUweRepository();
  const aiRuns = createAiRunServiceFromClient(prisma);

  let content: Record<string, string | null | undefined> = {};
  let canonicalStatus: string | undefined;
  let pageContent = "";

  if (context.kind === "campaign" && context.campaignSlug) {
    const overview = await createCampaignCockpitService(prisma).getCampaignOverview(
      context.worldSlug,
      context.campaignSlug,
    );
    if (overview) {
      content = {
        summary: overview.campaign.description,
        plannedSession: overview.nextSession
          ? `Session ${overview.nextSession.sessionNumber}: ${overview.nextSession.title}`
          : null,
        chapterList: overview.chapters.map((chapter) => chapter.title).join(", ") || null,
      };
    }
  } else if (context.kind === "session" && context.sessionId) {
    const db = createPrismaClient();
    const auth = createAuthService(db);
    const session = await auth.getGameSessionForDm(context.worldSlug, context.sessionId);
    await db.$disconnect();
    if (session) {
      content = {
        openPlots: session.openPlots,
        summary: session.summaryDm,
        playerText: session.summaryPlayer,
      };
    }
  } else if (context.pageSlug) {
    const page = await repo.getPageBySlug(context.worldSlug, context.pageSlug);
    if (page) {
      canonicalStatus = page.canonicalStatus;
      pageContent = page.contentBlocks.map((b) => b.content).join("\n");
      content = {
        summary: page.summary,
        description: pageContent,
        readAloud: page.contentBlocks
          .filter((b) => b.type === "player_text")
          .map((b) => b.content)
          .join("\n"),
        dmNotes: page.contentBlocks
          .filter((b) => b.type === "rich_text")
          .map((b) => b.content)
          .join("\n"),
      };
    }
  }

  const world = await repo.getWorldBySlug(context.worldSlug);
  // Kampagnen-History NICHT über pageId: der Anker (erstes Kapitel) wandert
  // mit der Sortierung. Stattdessen breiter laden und über resultMeta filtern.
  const isCampaign = context.kind === "campaign";
  const recentRuns = world
    ? (
        await aiRuns.list({
          worldId: world.id,
          pageId: isCampaign ? undefined : context.pageId,
          limit: isCampaign ? 25 : 5,
        })
      ).runs
        .map((run) => ({
          id: run.id,
          source: run.source ?? "ai_run",
          taskType: run.taskType,
          createdAt: run.createdAt,
          status: run.status,
          resultMeta: run.resultMeta as { actionId?: string; campaignId?: string | null } | null,
        }))
        .filter(
          (run) => !isCampaign || run.resultMeta?.campaignId === context.campaignId,
        )
        .slice(0, 5)
    : [];

  const view = buildDndGeneratorView({
    context,
    content,
    canonicalStatus,
    pageContent,
    recentRuns,
  });

  return NextResponse.json({ generator: view });
}
