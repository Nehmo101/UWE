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
} from "@/app/label-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";

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
  const flatPrinters = printerGroups.flatMap((g) =>
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
          <ul className="uwe-sidebar-links">
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
          <p className="uwe-table-sub" style={{ marginTop: "0.75rem" }}>
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
                className="uwe-v2-btn uwe-v2-btn-primary"
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
                  className="uwe-v2-btn"
                >
                  PDF exportieren
                </a>
                <a
                  href={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=png`}
                  className="uwe-v2-btn"
                >
                  PNG exportieren
                </a>
              </>
            }
            danger={
              <form action={deletePrintListAction} style={{ display: "inline" }}>
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="printListId" value={printListId} />
                <button type="submit" className="uwe-v2-btn uwe-v2-btn-danger">Löschen</button>
              </form>
            }
          />
        }
      />
      {(saved || created || added || status || queued) && (
        <p className="uwe-flash uwe-flash-success">
          {queued ? "RTX-Druckjob in Warteschlange." : created ? "Druckliste erstellt." : added ? "Label hinzugefügt." : status ? `Status: ${LABEL_PRINT_STATUS_LABELS[status as keyof typeof LABEL_PRINT_STATUS_LABELS]}` : "Gespeichert."}
        </p>
      )}
      {error && <p className="uwe-flash uwe-flash-warning">{decodeURIComponent(error)}</p>}

      {summary.hasDmOnly && (
        <p className="uwe-flash uwe-flash-warning">
          Diese Druckliste enthält Labels mit DM-only Inhalten.
        </p>
      )}

      <PrintListPreviewPanel
        exportUrl={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=html`}
      />

      <section className="uwe-panel">
        <h2>RTX Label-Druck</h2>
        {!connectorSummary.availableCapabilities.includes("label_printing") ? (
          <p className="uwe-hint">RTX Label-Druck offline. <a href="/system/rtx-connector">Connector</a></p>
        ) : flatPrinters.length === 0 ? (
          <p className="uwe-hint">Keine Drucker. <a href="/system/printers">Suchen</a></p>
        ) : (
          <PrintListRtxForm worldSlug={worldSlug} printListId={printListId} returnTo={returnTo} printers={printerOptions} defaultPrinterKey={defaultKey} hasDmOnly={summary.hasDmOnly} totalCopies={summary.totalCopies} labelCount={summary.labelCount} />
        )}
      </section>

      <section className="uwe-panel">
        <h2>Batch-Fortschritt</h2>
        <p className="uwe-table-sub" style={{ marginBottom: "0.75rem" }}>Status der RTX-Jobs für diese Druckliste — aktualisiert sich automatisch bei laufenden Jobs.</p>
        <PrintListJobPanel worldSlug={worldSlug} printListId={printListId} initialJobs={initialListJobs} printCenterHref={printCenterHref} />
      </section>

      <section className="uwe-panel">
        <h2>Druckliste bearbeiten</h2>
        <p className="uwe-table-sub">
          Reihenfolge per Drag &amp; Drop ändern, Kopien direkt editieren, dann speichern.
        </p>
        <form action={updatePrintListAction} className="uwe-form-grid">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="printListId" value={printListId} />

          <label>
            Name
            <input type="text" name="name" defaultValue={list.name} required />
          </label>
          <label>
            Beschreibung
            <textarea name="description" rows={2} defaultValue={list.description ?? ""} />
          </label>
          <label className="uwe-checkbox">
            <input type="checkbox" name="forNextSession" defaultChecked={list.forNextSession} />
            Für nächste Session vorbereitet
          </label>

          <PrintListEditor items={editorItems} />

          <div className="uwe-form-actions">
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">Speichern</button>
          </div>
        </form>
      </section>

      <div className="uwe-form-actions">
        <form action={setPrintListStatusAction} style={{ display: "inline" }}>
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="printListId" value={printListId} />
          <input type="hidden" name="status" value="printed" />
          <button type="submit" className="uwe-v2-btn">Als gedruckt markieren</button>
        </form>
      </div>
    </WorldShell>
  );
}
