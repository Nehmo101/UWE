import { createConnectorService, createLabelPrintQueueService, LABEL_PRINT_QUEUE_STATUS_LABELS, prisma } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { SystemPrintersClient } from "./SystemPrintersClient";
import {
  hasQueueLabelPrintingConnector,
  LABEL_PRINT_QUEUE_UNAVAILABLE_MESSAGE,
  queueLabelPrintingConnectorIds,
} from "@/src/lib/label-print-availability";

export const dynamic = "force-dynamic";

export default async function SystemPrintersPage({
  searchParams,
}: {
  searchParams: Promise<{ refreshed?: string; error?: string }>;
}) {
  const { refreshed, error } = await searchParams;
  const summary = await createConnectorService(prisma).summarize();
  const queue = createLabelPrintQueueService();
  const [groups, jobs] = await Promise.all([queue.listPrinters(), queue.listRecent({ limit: 30 })]);
  const queueConnectorIds = queueLabelPrintingConnectorIds(summary);
  const queueGroups = groups.filter((group) => queueConnectorIds.has(group.connectorId));

  const initial = {
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
  };

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "System", href: "/system" }, { label: "Drucker" }]}
        />
      }
    >
      <PageHeader title="Drucker" summary="RTX Label-Druck — Status wird alle 30 Sekunden aktualisiert." />
      <SystemPrintersClient
        initial={initial}
        initialError={error}
        initialRefreshed={Boolean(refreshed)}
      />
    </SystemShell>
  );
}
