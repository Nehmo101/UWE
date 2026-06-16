import { NextResponse } from "next/server";
import {
  buildWorldGraph,
  getAppRepository,
  GRAPH_NODE_CATEGORIES,
  type GraphNodeCategory,
  type GraphViewMode,
  type Visibility,
} from "@uwe/database/server";
import { parseParams, requireStudioApiAuth, worldSlugParamSchema } from "@uwe/security";

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const parsed = await parseParams(params, worldSlugParamSchema);
  if (!parsed.success) return parsed.response;

  const { worldSlug } = parsed.data;
  const url = new URL(request.url);
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  const campaignSlug = url.searchParams.get("campaign");
  const campaign = campaignSlug
    ? (await repo.listCampaignsByWorld(worldSlug)).find((item) => item.slug === campaignSlug)
    : null;

  const categoryParam = url.searchParams.getAll("category");
  const categories = categoryParam.filter((item): item is GraphNodeCategory =>
    GRAPH_NODE_CATEGORIES.includes(item as GraphNodeCategory),
  );

  const visibilityParam = url.searchParams.getAll("visibility");
  const visibilities = visibilityParam.length ? (visibilityParam as Visibility[]) : undefined;

  const tag = url.searchParams.get("tag") ?? undefined;
  const focusPageId = url.searchParams.get("focusPageId") ?? undefined;
  const mode = (url.searchParams.get("mode") as GraphViewMode | null) ?? "full";
  const preview = url.searchParams.get("preview") === "player";
  const context = preview ? "preview" : "dm";

  const graph = await buildWorldGraph(repo, worldSlug, context, {
    campaignId: campaign?.id,
    categories: categories.length ? categories : undefined,
    tags: tag ? [tag] : undefined,
    visibilities,
    focusPageId: focusPageId ?? undefined,
    mode: focusPageId ? mode : "full",
  });

  return NextResponse.json(graph);
}
