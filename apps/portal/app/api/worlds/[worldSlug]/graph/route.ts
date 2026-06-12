import { NextResponse } from "next/server";
import {
  buildWorldGraph,
  getAppRepository,
  getSystemSettings,
  isPortalGloballyEnabled,
} from "@uwe/database/server";

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
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

  const graph = await buildWorldGraph(repo, worldSlug, "portal");
  return NextResponse.json(graph);
}
