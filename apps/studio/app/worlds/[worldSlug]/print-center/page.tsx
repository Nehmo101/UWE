import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createLabelPrintQueueService,
  createLabelService,
  createPrintListService,
  getAppRepository,
  LABEL_PRINT_QUEUE_STATUS_LABELS,
  LABEL_PRINT_STATUS_LABELS,
  PRINT_CENTER_TEMPLATE_SLUGS,
} from "@uwe/database/server";
import { PrintQueuePanel } from "@/components/PrintQueuePanel";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PrintCenterPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();
  const labelService = createLabelService();
  const printListService = createPrintListService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const [labels, templates, printLists, jobs] = await Promise.all([
    labelService.listLabelsByWorld(worldSlug),
    labelService.listTemplates(world.id),
    printListService.listByWorld(worldSlug),
    createLabelPrintQueueService().listRecent({ worldId: world.id, limit: 20 }),
  ]);

  const systemTemplates = templates.filter((template) => template.isSystem || !template.worldId);
  const featuredSlugs = new Set<string>(Object.values(PRINT_CENTER_TEMPLATE_SLUGS));
  const featuredTemplates = systemTemplates.filter((template) => featuredSlugs.has(template.slug));

  const openPrintLists = printLists.filter((list) => list.status === "open");
  const labelsHref = `/worlds/${worldSlug}/labels/print`;
  const initialJobs = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    status: job.status,
    statusLabel: LABEL_PRINT_QUEUE_STATUS_LABELS[job.status],
    connectorName: job.connectorName ?? null,
    createdAt: job.createdAt.toISOString(),
  }));

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(
            world.name,
            worldSlug,
            "Print Center",
            `/worlds/${worldSlug}/print-center`,
          )}
        />
      }
    >
      <PageHeader
        title="Print Center"
        summary="6×4 Handouts, NPC- und Item-Karten, Drucklisten und Label-Vorlagen — zentral für die Session."
        actions={
          <Link href={`/worlds/${worldSlug}/labels/new`} className={buttonVariants()}>
            Neues Label
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Labels</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{labels.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Offene Drucklisten</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{openPrintLists.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Jobs in Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{jobs.length}</p>
            </CardContent>
          </Card>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Druckwarteschlange</h2>
          <p className="text-sm text-muted-foreground">
            Laufende RTX-Druckjobs aktualisieren sich automatisch.
          </p>
          <PrintQueuePanel worldSlug={worldSlug} initialJobs={initialJobs} labelsHref={labelsHref} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Schnellaktionen</h2>
          <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants({ variant: "outline" })} href={`/worlds/${worldSlug}/labels`}>
              Label-Bibliothek
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/worlds/${worldSlug}/labels?tab=print-lists`}
            >
              Drucklisten
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href={labelsHref}>
              RTX-Druck
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/worlds/${worldSlug}/prepare-session`}
            >
              Session vorbereiten
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Karten-Vorlagen (NPC / Item / Handout)</h2>
          {featuredTemplates.length === 0 ? (
            <EmptyState title="Keine Print-Center-Vorlagen gefunden" description="Migration prüfen." />
          ) : (
            <ul className="grid gap-2">
              {featuredTemplates.map((template) => (
                <li
                  key={template.id}
                  className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
                >
                  <strong>{template.name}</strong>
                  <p className="text-sm text-muted-foreground">{template.description ?? template.slug}</p>
                  <Link href={`/worlds/${worldSlug}/labels/new?template=${template.slug}`}>
                    Label mit Vorlage erstellen →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Offene Drucklisten</h2>
          {openPrintLists.length === 0 ? (
            <EmptyState
              title="Keine offenen Drucklisten"
              description="Erstelle eine aus einer Session oder unter Labels."
            />
          ) : (
            <ul className="grid gap-2">
              {openPrintLists.slice(0, 8).map((list) => (
                <li
                  key={list.id}
                  className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{list.name}</strong>
                    <Badge>{LABEL_PRINT_STATUS_LABELS[list.status]}</Badge>
                    {list.forNextSession ? <Badge variant="info">Nächste Session</Badge> : null}
                  </div>
                  <Link href={`/worlds/${worldSlug}/labels/print-lists/${list.id}`}>Öffnen →</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </WorldShell>
  );
}
