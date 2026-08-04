import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createBrainStoreService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import {
  brainEntryCreateBodySchema,
  parseBody,
  parseParams,
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
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsedParams = await parseParams(params, worldSlugParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const { worldSlug } = parsedParams.data;
  const url = new URL(request.url);
  const campaignSlug = url.searchParams.get("campaign");

  const { db, brain, repo } = brainService();
  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      return jsonError("Welt nicht gefunden.", 404);
    }

    const campaign = campaignSlug
      ? (await repo.listCampaignsByWorld(worldSlug)).find((c) => c.slug === campaignSlug)
      : null;

    const [documents, facts, summary] = await Promise.all([
      brain.listDocuments(worldSlug, {
        campaignId: campaign?.id,
      }),
      brain.listFacts(worldSlug, {
        campaignId: campaign?.id,
      }),
      brain.getWorldSummary(worldSlug),
    ]);

    return NextResponse.json({ documents, facts, summary });
  } finally {
    await db.$disconnect();
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const authError = await guardStudioApiRequest(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsedParams = await parseParams(params, worldSlugParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, brainEntryCreateBodySchema);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;

  const { worldSlug } = parsedParams.data;
  const { db, brain, repo } = brainService();
  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      return jsonError("Welt nicht gefunden.", 404);
    }

    if (body.kind === "document") {
      const document = await brain.createDocument({
        worldId: world.id,
        title: body.title,
        content: body.content,
        documentType: body.documentType,
        source: body.source,
        status: body.status,
        campaignId: body.campaignId ?? null,
        pageId: body.pageId ?? null,
        gameSessionId: body.gameSessionId ?? null,
      });
      return NextResponse.json({ document }, { status: 201 });
    }

    const fact = await brain.createFact({
      worldId: world.id,
      title: body.title,
      content: body.content,
      factType: body.factType,
      source: body.source,
      status: body.status,
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
