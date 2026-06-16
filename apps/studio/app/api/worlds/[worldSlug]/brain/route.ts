import { NextResponse } from "next/server";
import {
  createBrainStoreService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import {
  guardStudioMutation,
  parseBody,
  parseParams,
  passthroughBodySchema,
  requireStudioApiAuth,
  safeHandlerError,
  worldSlugParamSchema,
} from "@uwe/security";

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

function brainService() {
  const db = createPrismaClient();
  return { db, brain: createBrainStoreService(), repo: getAppRepository() };
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const parsedParams = await parseParams(params, worldSlugParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const { worldSlug } = parsedParams.data;
  const url = new URL(request.url);
  const campaignSlug = url.searchParams.get("campaign");
  const accessContext = url.searchParams.get("accessContext") === "portal" ? "portal" : "dm";

  const { db, brain, repo } = brainService();
  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      return NextResponse.json({ error: "Welt nicht gefunden." }, { status: 404 });
    }

    const campaign = campaignSlug
      ? (await repo.listCampaignsByWorld(worldSlug)).find((c) => c.slug === campaignSlug)
      : null;

    const [documents, facts, summary] = await Promise.all([
      brain.listDocuments(worldSlug, {
        campaignId: campaign?.id,
        accessContext,
      }),
      brain.listFacts(worldSlug, {
        campaignId: campaign?.id,
        accessContext,
      }),
      brain.getWorldSummary(worldSlug),
    ]);

    return NextResponse.json({ documents, facts, summary });
  } finally {
    await db.$disconnect();
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const authError = guardStudioMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsedParams = await parseParams(params, worldSlugParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, passthroughBodySchema);
  if (!parsed.success) return parsed.response;

  const body = parsed.data as {
    kind?: string;
    title?: string;
    content?: string;
    documentType?: string;
    factType?: string;
    visibility?: string;
    source?: string;
    status?: string;
    campaignId?: string | null;
    pageId?: string | null;
    gameSessionId?: string | null;
  };

  if (!body.kind || !body.title?.trim()) {
    return NextResponse.json({ error: "kind und title sind erforderlich." }, { status: 400 });
  }

  const { worldSlug } = parsedParams.data;
  const { db, brain, repo } = brainService();
  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      return NextResponse.json({ error: "Welt nicht gefunden." }, { status: 404 });
    }

    if (body.kind === "document") {
      const document = await brain.createDocument({
        worldId: world.id,
        title: body.title.trim(),
        content: body.content ?? "",
        documentType: (body.documentType as never) ?? "general",
        visibility: (body.visibility as never) ?? "dm_only",
        source: (body.source as never) ?? "manual",
        status: (body.status as never) ?? "draft",
        campaignId: body.campaignId ?? null,
        pageId: body.pageId ?? null,
        gameSessionId: body.gameSessionId ?? null,
      });
      return NextResponse.json({ document }, { status: 201 });
    }

    const fact = await brain.createFact({
      worldId: world.id,
      title: body.title.trim(),
      content: body.content ?? "",
      factType: (body.factType as never) ?? "custom",
      visibility: (body.visibility as never) ?? "dm_only",
      source: (body.source as never) ?? "manual",
      status: (body.status as never) ?? "draft",
      campaignId: body.campaignId ?? null,
      pageId: body.pageId ?? null,
      gameSessionId: body.gameSessionId ?? null,
    });
    return NextResponse.json({ fact }, { status: 201 });
  } catch (error) {
    return safeHandlerError(error, "Brain-Eintrag konnte nicht erstellt werden.");
  } finally {
    await db.$disconnect();
  }
}
