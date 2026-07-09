import { capabilityOfflineMessage } from "@uwe/connector";
import { createConnectorService, createLabelPrintQueueService, LABEL_PRINT_QUEUE_STATUS_LABELS, prisma } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { SystemPrintersClient } from "./SystemPrintersClient";

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

  const initial = {
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
