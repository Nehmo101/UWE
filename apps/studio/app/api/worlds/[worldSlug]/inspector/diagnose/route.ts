import { NextResponse } from "next/server";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";
import { getAppRepository } from "@uwe/database/server";
import { enqueueAndDispatch } from "@/src/lib/job-executor";

interface RouteContext {
  params: Promise<{ worldSlug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const { worldSlug } = await context.params;
  await requireStudioWorldEdit(worldSlug);

  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Welt nicht gefunden." }, { status: 404 });
  }

  const job = await enqueueAndDispatch({
    type: "canon_check",
    title: `Kanonprüfung: ${world.name}`,
    worldId: world.id,
    worldSlug,
    payload: { worldSlug },
    relatedType: "world",
    relatedId: world.id,
  });

  return NextResponse.json({ job: { id: job.id, status: job.status } }, { status: 202 });
}
