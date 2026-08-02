import Link from "next/link";
import { notFound } from "next/navigation";
import { createLabelPrintQueueService, createPrintListService, getAppRepository, LABEL_PRINT_QUEUE_STATUS_LABELS } from "@uwe/database/server";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { Badge, buttonVariants, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/src/components/ui";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

export default async function WorldLabelsPrintPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();
  const [lists, jobs] = await Promise.all([createPrintListService().listByWorld(worldSlug), createLabelPrintQueueService().listRecent({ worldId: world.id, limit: 20 })]);
  return (
    <>
      <ShellBreadcrumb items={worldSectionBreadcrumb(world.name, worldSlug, "RTX-Druck", `/worlds/${worldSlug}/labels/print`)} />
      <PageHeader title="RTX-Druck" summary="Drucklisten an lokale Drucker senden." />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Drucklisten</CardTitle>
          </CardHeader>
          <CardContent>
            {lists.length === 0 ? (
              <EmptyState
                title="Noch keine Drucklisten"
                description="Bündle Labels in der Label-Bibliothek zu einer Druckliste, dann erscheint sie hier."
                action={
                  <Link href={`/worlds/${worldSlug}/labels`} className={buttonVariants({ variant: "secondary" })}>
                    Zur Label-Bibliothek
                  </Link>
                }
              />
            ) : (
              <ul className="grid gap-2">
                {lists.map((l) => (
                  <li
                    key={l.id}
                    className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
                  >
                    <strong>
                      <Link href={`/worlds/${worldSlug}/labels/print-lists/${l.id}`}>{l.name}</Link>
                    </strong>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {l.items.length === 1 ? "1 Eintrag" : `${l.items.length} Einträge`}
                    </p>
                    <p className="text-sm text-muted-foreground">Öffnen zum Drucken</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Druckaufträge</CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <EmptyState
                title="Keine Druckaufträge"
                description="Gesendete Drucklisten tauchen hier mit Status auf."
              />
            ) : (
              <ul className="grid gap-2">
                {jobs.map((j) => (
                  <li
                    key={j.id}
                    className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{j.title}</strong>
                      <Badge>{LABEL_PRINT_QUEUE_STATUS_LABELS[j.status]}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weitere Druckwege</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 pl-5 list-disc">
              <li>
                <Link href={`/worlds/${worldSlug}/labels`}>Label-Bibliothek</Link>{" "}
                <span className="text-sm text-muted-foreground">— Einzelne Labels bearbeiten und Vorschau drucken</span>
              </li>
              <li>
                <Link href={`/worlds/${worldSlug}/labels?tab=print-lists`}>Drucklisten verwalten</Link>{" "}
                <span className="text-sm text-muted-foreground">— Labels bündeln und Kopienanzahl festlegen</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
