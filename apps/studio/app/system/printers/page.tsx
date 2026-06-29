import { capabilityOfflineMessage } from "@uwe/connector";
import { createConnectorService, createLabelPrintQueueService, LABEL_PRINT_QUEUE_STATUS_LABELS, prisma } from "@uwe/database/server";
import { refreshPrintersAction } from "@/app/label-print-actions";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/src/components/ui";
export const dynamic = "force-dynamic";
export default async function SystemPrintersPage({ searchParams }: { searchParams: Promise<{ refreshed?: string; error?: string }> }) {
  const { refreshed, error } = await searchParams;
  const summary = await createConnectorService(prisma).summarize();
  const queue = createLabelPrintQueueService();
  const [groups, jobs] = await Promise.all([queue.listPrinters(), queue.listRecent({ limit: 30 })]);
  const ok = summary.availableCapabilities.includes("label_printing");
  return (
    <AdminModuleShell activePath="/system/printers" bottomNav="more" title="Drucker" summary="RTX Label-Druck" breadcrumbs={[{ label: "System", href: "/system" }, { label: "Drucker" }]}>
      {error && <Alert tone="danger" title="Fehler">{decodeURIComponent(error)}</Alert>}
      {refreshed && <Alert tone="success" title="OK">Drucker-Suche gestartet.</Alert>}
      {!ok && <Alert tone="warning" title="Offline">{capabilityOfflineMessage("label_printing")}</Alert>}
      <Card><CardHeader><CardTitle>Drucker</CardTitle></CardHeader><CardContent>
        <form action={refreshPrintersAction}><input type="hidden" name="returnTo" value="/system/printers" /><Button type="submit" disabled={!ok}>Suchen</Button></form>
        {groups.every(g=>!g.printers.length) ? <EmptyState title="Keine Drucker" /> : groups.flatMap(g=>g.printers.map(p=><p key={p.id}>{p.name} ({g.connectorName})</p>))}
      </CardContent></Card>
      <Card style={{marginTop:"1rem"}}><CardHeader><CardTitle>Queue</CardTitle></CardHeader><CardContent>
        {jobs.length===0 ? <EmptyState title="Leer"/> : jobs.map(j=><p key={j.id}>{j.title} — {LABEL_PRINT_QUEUE_STATUS_LABELS[j.status]}</p>)}
      </CardContent></Card>
    </AdminModuleShell>
  );
}
