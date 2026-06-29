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
import { PrintListEditor } from "@/components/PrintListEditor";
import {
  deletePrintListAction,
  setPrintListStatusAction,
  updatePrintListAction,
} from "@/app/label-actions";
import { enqueueLabelPrintAction } from "@/app/label-print-actions";
import { WorldModuleShell } from "@/components/WorldModuleShell";
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
  const [connectorSummary, printerGroups] = await Promise.all([
    connectorService.summarize(),
    printQueue.listPrinters(),
  ]);
  const flatPrinters = printerGroups.flatMap((g) =>
    g.printers.map((p) => ({ ...p, connectorId: g.connectorId, connectorName: g.connectorName })),
  );
  const defaultKey = (() => {
    const p = flatPrinters.find((x) => x.isDefault) ?? flatPrinters[0];
    return p ? `${p.connectorId}::${p.id}::${p.name}` : undefined;
  })();
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
    <WorldModuleShell
      worldSlug={worldSlug}
      worldName={world.name}
      activeNav="labels"
      backLink={{ label: "← Drucklisten", href: `/worlds/${worldSlug}/labels?tab=print-lists` }}
      breadcrumb={worldDetailBreadcrumb(
        world.name,
        worldSlug,
        "Labels",
        `/worlds/${worldSlug}/labels?tab=print-lists`,
        list.name,
      )}
      pageHeader={{
        title: list.name,
        summary: `${summary.labelCount} Labels · ${summary.totalCopies} Kopien · Status: ${LABEL_PRINT_STATUS_LABELS[list.status]}`,
        actions: (
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
        ),
      }}
      context={
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

      <section className="uwe-panel">
        <h2>RTX Label-Druck</h2>
        {!connectorSummary.availableCapabilities.includes("label_printing") ? (
          <p className="uwe-hint">RTX Label-Druck offline. <a href="/system/rtx-connector">Connector</a></p>
        ) : flatPrinters.length === 0 ? (
          <p className="uwe-hint">Keine Drucker. <a href="/system/printers">Suchen</a></p>
        ) : (
          <form action={enqueueLabelPrintAction} className="uwe-form-grid">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="printListId" value={printListId} />
            <input type="hidden" name="returnTo" value={`/worlds/${worldSlug}/labels/print-lists/${printListId}`} />
            <label>Drucker
              <select name="printerKey" required defaultValue={defaultKey}>
                {flatPrinters.map((p) => (
                  <option key={`${p.connectorId}-${p.id}`} value={`${p.connectorId}::${p.id}::${p.name}`}>{p.name} ({p.connectorName})</option>
                ))}
              </select>
            </label>
            <label>Format<select name="format" defaultValue="pdf"><option value="pdf">PDF</option><option value="html">HTML</option></select></label>
            <label className="uwe-checkbox"><input type="checkbox" name="includeDmOnly" /> DM-only</label>
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">An RTX-Drucker senden</button>
          </form>
        )}
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
    </WorldModuleShell>
  );
}
