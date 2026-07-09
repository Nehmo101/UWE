import { NextResponse } from "next/server";
import {
  createLabelPrintQueueService,
  getAppRepository,
  LABEL_PRINT_QUEUE_STATUS_LABELS,
} from "@uwe/database/server";
import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";

interface RouteContext {
  params: Promise<{ worldSlug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const { worldSlug } = await context.params;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Welt nicht gefunden." }, { status: 404 });
  }

  const jobs = await createLabelPrintQueueService().listRecent({
    worldId: world.id,
    limit: 20,
  });

  return NextResponse.json({
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      statusLabel: LABEL_PRINT_QUEUE_STATUS_LABELS[job.status],
      connectorName: job.connectorName ?? null,
      createdAt: job.createdAt.toISOString(),
    })),
  });
}
