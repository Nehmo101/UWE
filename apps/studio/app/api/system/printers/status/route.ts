import { NextResponse } from "next/server";
import {
  createConnectorService,
  createLabelPrintQueueService,
  LABEL_PRINT_QUEUE_STATUS_LABELS,
  prisma,
} from "@uwe/database/server";
import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import {
  hasQueueLabelPrintingConnector,
  LABEL_PRINT_QUEUE_UNAVAILABLE_MESSAGE,
  queueLabelPrintingConnectorIds,
} from "@/src/lib/label-print-availability";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const summary = await createConnectorService(prisma).summarize();
  const queue = createLabelPrintQueueService();
  const [groups, jobs] = await Promise.all([queue.listPrinters(), queue.listRecent({ limit: 30 })]);
  const queueConnectorIds = queueLabelPrintingConnectorIds(summary);
  const queueGroups = groups.filter((group) => queueConnectorIds.has(group.connectorId));

  return NextResponse.json({
    ok: hasQueueLabelPrintingConnector(summary),
    offlineMessage: LABEL_PRINT_QUEUE_UNAVAILABLE_MESSAGE,
    printers: queueGroups.flatMap((group) =>
      group.printers.map((printer) => ({
        id: printer.id,
        name: printer.name,
        connectorName: group.connectorName,
      })),
    ),
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      statusLabel: LABEL_PRINT_QUEUE_STATUS_LABELS[job.status],
    })),
    timestamp: new Date().toISOString(),
  });
}
