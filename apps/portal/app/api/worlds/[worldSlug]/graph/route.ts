import { NextResponse } from "next/server";
import { buildWorldGraph, getAppRepository } from "@uwe/database/server";

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { worldSlug } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  const graph = await buildWorldGraph(repo, worldSlug, "portal");
  return NextResponse.json(graph);
}
