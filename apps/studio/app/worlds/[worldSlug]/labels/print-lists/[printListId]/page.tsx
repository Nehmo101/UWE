import { notFound } from "next/navigation";
import {
  ContextActions,
  SidebarSection,
} from "@uwe/shared-ui";
import {
  createConnectorService,
  createLabelPrintQueueService,
  createPrintListService,
  getAppRepository,
  LABEL_PRINT_STATUS_LABELS,
  normalizeLabel,
  prisma,
  summarizePrintList,
} from "@uwe/database/server";
import {
  PRINT_LIST_BATCH_JOB_PHASE_LABELS,
  toPrintListBatchJobPhase,
} from "@uwe/database/label-print-queue";
import { PrintListEditor } from "@/components/PrintListEditor";
import { PrintListJobPanel } from "@/components/PrintListJobPanel";
import { PrintListPreviewPanel } from "@/components/PrintListPreviewPanel";
import { PrintListRtxForm } from "@/components/PrintListRtxForm";
import {
  deletePrintListAction,
  setPrintListStatusAction,
  updatePrintListAction,
} from "@/app/print-list-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  Alert,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@/src/components/ui";
import {
  hasQueueLabelPrintingConnector,
  queueLabelPrintingConnectorIds,
} from "@/src/lib/label-print-availability";

interface Props {
  params: Promise<{ worldSlug: string; printListId: string }>;
  searchParams: Promise<{ saved?: string; created?: string; added?: string; status?: string; queued?: string; error?: string }>;
}

export default async function PrintListDetailPage({ params, searchParams }: Props) {
  const { worldSlug, printListId } = await params;
  const { saved, created, added, status, queued, error } = await searchParams;

  const repo = getAppRepository();
  const printListService = createPrintListService();
  const connectorService = createConnectorService(prisma);
  const printQueue = createLabelPrintQueueService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const list = await printListService.getById(printListId);
  if (!list || list.worldId !== world.id) notFound();

  const summary = summarizePrintList(list);
  const [connectorSummary, printerGroups, listJobs] = await Promise.all([
    connectorService.summarize(),
    printQueue.listPrinters(),
    printQueue.listByPrintList(printListId, { worldId: world.id, limit: 20 }),
  ]);
  const queueConnectorIds = queueLabelPrintingConnectorIds(connectorSummary);
  const flatPrinters = printerGroups.filter((group) => queueConnectorIds.has(group.connectorId)).flatMap((g) =>
    g.printers.map((p) => ({ ...p, connectorId: g.connectorId, connectorName: g.connectorName })),
  );
  const defaultKey = (() => {
    const p = flatPrinters.find((x) => x.isDefault) ?? flatPrinters[0];
    return p ? `${p.connectorId}::${p.id}::${p.name}` : undefined;
  })();
  const printerOptions = flatPrinters.map((p) => ({ key: `${p.connectorId}::${p.id}::${p.name}`, label: `${p.name} (${p.connectorName})` }));
  const initialListJobs = listJobs.map((job) => { const phase = toPrintListBatchJobPhase(job.status); return { id: job.id, title: job.title, phase, phaseLabel: PRINT_LIST_BATCH_JOB_PHASE_LABELS[phase], connectorName: job.connectorName ?? null, printerName: job.printerName ?? null, failedReason: job.failedReason ?? null, createdAt: job.createdAt.toISOString(), completedAt: job.completedAt?.toISOString() ?? null }; });
  const printCenterHref = `/worlds/${worldSlug}/print-center`;
  const returnTo = `/worlds/${worldSlug}/labels/print-lists/${printListId}`;
  const editorItems = list.items.map((item) => {
    const parsed = normalizeLabel(item.label);
    return {
      labelId: item.labelId,
      title: item.label.title,
      copies: item.copies,
      containsDmOnly: parsed.content.containsDmOnly,
      previewHref: `/worlds/${worldSlug}/labels/${item.labelId}/preview`,
      labelHref: `/worlds/${worldSlug}/labels/${item.labelId}`,
    };
  });

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldDetailBreadcrumb(
            world.name,
            worldSlug,
            "Labels",
            `/worlds/${worldSlug}/labels?tab=print-lists`,
            list.name,
          )}
        />
      }
      contextPanel={
        <SidebarSection title="Export">
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <a href={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=html`}>
                HTML exportieren
              </a>
            </li>
            <li>
              <a href={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=pdf`}>
                PDF exportieren
              </a>
            </li>
            <li>
              <a href={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=png`}>
                PNG (ZIP) — erste Seite
              </a>
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Bei PDF-Fehlern liefert der Export Print-HTML mit Header{" "}
            <code>X-UWE-Export-Fallback: 1</code>.
          </p>
        </SidebarSection>
      }
    >
      <PageHeader
        title={list.name}
        summary={`${summary.labelCount} Labels · ${summary.totalCopies} Kopien · Status: ${LABEL_PRINT_STATUS_LABELS[list.status]}`}
        actions={
          <ContextActions
            primary={
              <a
                href={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=print`}
                className={buttonVariants()}
                target="_blank"
                rel="noreferrer"
              >
                Druckliste drucken
              </a>
            }
            secondary={
              <>
                <a
                  href={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=pdf`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  PDF exportieren
                </a>
                <a
                  href={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=png`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  PNG exportieren
                </a>
              </>
            }
            danger={
              <form action={deletePrintListAction} className="inline">
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="printListId" value={printListId} />
                <Button type="submit" variant="destructive">Löschen</Button>
              </form>
            }
          />
        }
      />

      <div className="flex flex-col gap-6">
        {(saved || created || added || status || queued) && (
          <Alert tone="success">
            {queued ? "RTX-Druckjob in Warteschlange." : created ? "Druckliste erstellt." : added ? "Label hinzugefügt." : status ? `Status: ${LABEL_PRINT_STATUS_LABELS[status as keyof typeof LABEL_PRINT_STATUS_LABELS]}` : "Gespeichert."}
          </Alert>
        )}
        {error && <Alert tone="warning">{decodeURIComponent(error)}</Alert>}

        {summary.hasDmOnly && (
          <Alert tone="warning">Diese Druckliste enthält Labels mit DM-only Inhalten.</Alert>
        )}

        <PrintListPreviewPanel
          exportUrl={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=html`}
        />

        <Card>
          <CardHeader>
            <CardTitle>RTX Label-Druck</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasQueueLabelPrintingConnector(connectorSummary) ? (
              <p className="text-sm text-muted-foreground">
                RTX Label-Druck benötigt Queue- oder Hybrid-Modus.{" "}
                <a href="/system/rtx-connector">Connector</a>
              </p>
            ) : flatPrinters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Drucker. <a href="/system/printers">Suchen</a>
              </p>
            ) : (
              <PrintListRtxForm worldSlug={worldSlug} printListId={printListId} returnTo={returnTo} printers={printerOptions} defaultPrinterKey={defaultKey} hasDmOnly={summary.hasDmOnly} totalCopies={summary.totalCopies} labelCount={summary.labelCount} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Batch-Fortschritt</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Status der RTX-Jobs für diese Druckliste — aktualisiert sich automatisch bei laufenden Jobs.
            </p>
            <PrintListJobPanel worldSlug={worldSlug} printListId={printListId} initialJobs={initialListJobs} printCenterHref={printCenterHref} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Druckliste bearbeiten</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Reihenfolge per Drag &amp; Drop ändern, Kopien direkt editieren, dann speichern.
            </p>
            <form action={updatePrintListAction} className="flex flex-col gap-4">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="printListId" value={printListId} />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="print-list-name">Name</Label>
                <Input id="print-list-name" type="text" name="name" defaultValue={list.name} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="print-list-description">Beschreibung</Label>
                <Textarea
                  id="print-list-description"
                  name="description"
                  rows={2}
                  defaultValue={list.description ?? ""}
                />
              </div>
              {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="forNextSession"
                  defaultChecked={list.forNextSession}
                  className="size-4 rounded border-input"
                />
                Für nächste Session vorbereitet
              </label>

              <PrintListEditor items={editorItems} />

              <div className="flex flex-wrap gap-2">
                <Button type="submit">Speichern</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <form action={setPrintListStatusAction} className="inline">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="printListId" value={printListId} />
            <input type="hidden" name="status" value="printed" />
            <Button type="submit" variant="outline">Als gedruckt markieren</Button>
          </form>
        </div>
      </div>
    </WorldShell>
  );
}
