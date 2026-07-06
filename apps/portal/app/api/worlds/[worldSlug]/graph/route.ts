import { NextResponse } from "next/server";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import { buildWorldGraphForViewer } from "@uwe/database/graph-service";
import {
  getAppRepository,
  getSystemSettings,
  isPortalGloballyEnabled,
  type GraphViewMode,
} from "@uwe/database/server";
import { assertCanReadWorldWithContext } from "@uwe/auth";
import { getAccessContextForWorld } from "@/src/lib/auth";

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

  const settings = await getSystemSettings();
  if (!isPortalGloballyEnabled(settings)) {
    return NextResponse.json({ error: "Portal disabled" }, { status: 403 });
  }

  const { worldSlug } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertCanReadWorldWithContext(ctx, world.id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const focusPageId = url.searchParams.get("focusPageId") ?? undefined;
  const mode = (url.searchParams.get("mode") as GraphViewMode | null) ?? "full";

  const graph = await buildWorldGraphForViewer(repo, worldSlug, ctx, {
    focusPageId,
    mode: focusPageId ? mode : "full",
  });
  return NextResponse.json(graph);
}
