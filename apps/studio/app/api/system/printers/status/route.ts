import { NextResponse } from "next/server";
import { capabilityOfflineMessage } from "@uwe/connector";
import {
  createConnectorService,
  createLabelPrintQueueService,
  LABEL_PRINT_QUEUE_STATUS_LABELS,
  prisma,
} from "@uwe/database/server";
import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const summary = await createConnectorService(prisma).summarize();
  const queue = createLabelPrintQueueService();
  const [groups, jobs] = await Promise.all([queue.listPrinters(), queue.listRecent({ limit: 30 })]);

  return NextResponse.json({
    ok: summary.availableCapabilities.includes("label_printing"),
    offlineMessage: capabilityOfflineMessage("label_printing"),
    printers: groups.flatMap((group) =>
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
