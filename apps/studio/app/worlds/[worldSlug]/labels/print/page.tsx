import Link from "next/link";
import { notFound } from "next/navigation";
import { createLabelPrintQueueService, createPrintListService, getAppRepository, LABEL_PRINT_QUEUE_STATUS_LABELS } from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/src/components/ui";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

export default async function WorldLabelsPrintPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();
  const [lists, jobs] = await Promise.all([createPrintListService().listByWorld(worldSlug), createLabelPrintQueueService().listRecent({ worldId: world.id, limit: 20 })]);
  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "RTX-Druck", `/worlds/${worldSlug}/labels/print`)}
        />
      }
    >
      <PageHeader title="RTX-Druck" summary="Drucklisten an lokale Drucker senden." />

      <section className="uwe-v2-card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Druckwege im Überblick</h2>
        <table className="uwe-page-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Zweck</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link href={`/worlds/${worldSlug}/labels`}>Label-Bibliothek</Link>
              </td>
              <td>Einzelne Labels bearbeiten, Status setzen, zur Druckliste hinzufügen</td>
            </tr>
            <tr>
              <td>
                <code>/labels/[id]/preview</code>
              </td>
              <td>Interaktive Browser-Vorschau mit DM-only-Warnung (kein Queue-Job)</td>
            </tr>
            <tr>
              <td>
                <code>/api/…/export?format=print</code>
              </td>
              <td>Druckoptimiertes HTML/PDF für Browser-Druck oder Download</td>
            </tr>
            <tr>
              <td>
                <Link href={`/worlds/${worldSlug}/labels?tab=print-lists`}>Drucklisten</Link>
              </td>
              <td>Mehrere Labels bündeln, Kopienanzahl festlegen</td>
            </tr>
            <tr>
              <td>
                <strong>Diese Seite (RTX-Druck)</strong>
              </td>
              <td>Drucklisten an den lokalen RTX-Connector / Netzwerkdrucker senden</td>
            </tr>
          </tbody>
        </table>
      </section>

      <Card><CardHeader><CardTitle>Drucklisten</CardTitle></CardHeader><CardContent>
        {lists.length===0 ? <EmptyState title="Keine Listen"/> : lists.map(l=><p key={l.id}><Link href={`/worlds/${worldSlug}/labels/print-lists/${l.id}`}>{l.name}</Link></p>)}
      </CardContent></Card>
      <Card style={{marginTop:"1rem"}}><CardHeader><CardTitle>Queue</CardTitle></CardHeader><CardContent>
        {jobs.length===0 ? <EmptyState title="Leer"/> : jobs.map(j=><p key={j.id}>{j.title} — {LABEL_PRINT_QUEUE_STATUS_LABELS[j.status]}</p>)}
      </CardContent></Card>
    </WorldShell>
  );
}
