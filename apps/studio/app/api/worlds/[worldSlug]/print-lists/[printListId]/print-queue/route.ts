import { NextResponse } from "next/server";
import {
  createLabelPrintQueueService,
  createPrintListService,
  getAppRepository,
} from "@uwe/database/server";
import {
  PRINT_LIST_BATCH_JOB_PHASE_LABELS,
  toPrintListBatchJobPhase,
} from "@uwe/database/label-print-queue";
import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { idSchema, parseParams, worldSlugParamSchema } from "@uwe/security";

const printListQueueParamsSchema = worldSlugParamSchema.extend({
  printListId: idSchema,
});

interface RouteContext {
  params: Promise<{ worldSlug: string; printListId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, printListQueueParamsSchema);
  if (!parsedParams.success) return parsedParams.response;

  const { worldSlug, printListId } = parsedParams.data;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Welt nicht gefunden." }, { status: 404 });
  }

  const list = await createPrintListService().getById(printListId);
  if (!list || list.worldId !== world.id) {
    return NextResponse.json({ error: "Druckliste nicht gefunden." }, { status: 404 });
  }

  const jobs = await createLabelPrintQueueService().listByPrintList(printListId, {
    worldId: world.id,
    limit: 20,
  });

  return NextResponse.json({
    jobs: jobs.map((job) => {
      const phase = toPrintListBatchJobPhase(job.status);
      return {
        id: job.id,
        title: job.title,
        status: job.status,
        phase,
        phaseLabel: PRINT_LIST_BATCH_JOB_PHASE_LABELS[phase],
        connectorName: job.connectorName ?? null,
        printerName: job.printerName ?? null,
        failedReason: job.failedReason ?? null,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
      };
    }),
  });
}
