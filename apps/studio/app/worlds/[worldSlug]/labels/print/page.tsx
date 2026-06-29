import Link from "next/link";
import { notFound } from "next/navigation";
import { createLabelPrintQueueService, createPrintListService, getAppRepository, LABEL_PRINT_QUEUE_STATUS_LABELS } from "@uwe/database/server";
import { WorldModuleShell } from "@/components/WorldModuleShell";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/src/components/ui";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
export default async function WorldLabelsPrintPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();
  const [lists, jobs] = await Promise.all([createPrintListService().listByWorld(worldSlug), createLabelPrintQueueService().listRecent({ worldId: world.id, limit: 20 })]);
  return (
    <WorldModuleShell
      worldSlug={worldSlug}
      worldName={world.name}
      activeNav="labels"
      breadcrumb={worldSectionBreadcrumb(world.name, worldSlug, "RTX-Druck", `/worlds/${worldSlug}/labels/print`)}
      pageHeader={{ title: "RTX-Druck", summary: "Drucklisten an lokale Drucker senden." }}
    >
      <Card><CardHeader><CardTitle>Drucklisten</CardTitle></CardHeader><CardContent>
        {lists.length===0 ? <EmptyState title="Keine Listen"/> : lists.map(l=><p key={l.id}><Link href={`/worlds/${worldSlug}/labels/print-lists/${l.id}`}>{l.name}</Link></p>)}
      </CardContent></Card>
      <Card style={{marginTop:"1rem"}}><CardHeader><CardTitle>Queue</CardTitle></CardHeader><CardContent>
        {jobs.length===0 ? <EmptyState title="Leer"/> : jobs.map(j=><p key={j.id}>{j.title} — {LABEL_PRINT_QUEUE_STATUS_LABELS[j.status]}</p>)}
      </CardContent></Card>
    </WorldModuleShell>
  );
}
