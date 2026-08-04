import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  buildWorldGraph,
  getAppRepository,
  GRAPH_NODE_CATEGORIES,
  type GraphNodeCategory,
  type GraphViewMode,
} from "@uwe/database/server";
import { buildWorldGraphForViewer } from "@uwe/database/graph-service";
import { buildPlayerViewContext } from "@uwe/auth";
import { parseParams, worldSlugParamSchema } from "@uwe/security";

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = await parseParams(params, worldSlugParamSchema);
  if (!parsed.success) return parsed.response;

  const { worldSlug } = parsed.data;
  const url = new URL(request.url);
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    return jsonError("World not found", 404);
  }

  const campaignSlug = url.searchParams.get("campaign");
  const campaign = campaignSlug
    ? (await repo.listCampaignsByWorld(worldSlug)).find((item) => item.slug === campaignSlug)
    : null;

  const categoryParam = url.searchParams.getAll("category");
  const categories = categoryParam.filter((item): item is GraphNodeCategory =>
    GRAPH_NODE_CATEGORIES.includes(item as GraphNodeCategory),
  );
  const tag = url.searchParams.get("tag") ?? undefined;
  const focusPageId = url.searchParams.get("focusPageId") ?? undefined;
  const mode = (url.searchParams.get("mode") as GraphViewMode | null) ?? "full";
  const filters = {
    campaignId: campaign?.id,
    categories: categories.length ? categories : undefined,
    tags: tag ? [tag] : undefined,
    focusPageId: focusPageId ?? undefined,
    mode: focusPageId ? mode : ("full" as const),
  };

  // `preview=player` liefert die Spielersicht: derselbe Filterpfad wie im
  // Portal (nur freigegebene Seiten, ohne DM-Bereiche). Darauf verlassen sich
  // die MCP-Tools `portal_player_view_*` — vorher wurde der Parameter still
  // ignoriert und die DM-Sicht ausgeliefert.
  const graph =
    url.searchParams.get("preview") === "player"
      ? await buildWorldGraphForViewer(repo, worldSlug, buildPlayerViewContext(world.id), filters)
      : await buildWorldGraph(repo, worldSlug, filters);

  return NextResponse.json(graph);
}
