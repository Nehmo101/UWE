import { notFound } from "next/navigation";
import {
  ContextActions,
  SidebarSection,
} from "@uwe/shared-ui";
import {
  createPrintListService,
  getAppRepository,
  LABEL_PRINT_STATUS_LABELS,
  normalizeLabel,
  summarizePrintList,
} from "@uwe/database/server";
import { PrintListEditor } from "@/components/PrintListEditor";
import {
  deletePrintListAction,
  setPrintListStatusAction,
  updatePrintListAction,
} from "@/app/label-actions";
import { WorldModuleShell } from "@/components/WorldModuleShell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string; printListId: string }>;
  searchParams: Promise<{ saved?: string; created?: string; added?: string; status?: string }>;
}

export default async function PrintListDetailPage({ params, searchParams }: Props) {
  const { worldSlug, printListId } = await params;
  const { saved, created, added, status } = await searchParams;

  const repo = getAppRepository();
  const printListService = createPrintListService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const list = await printListService.getById(printListId);
  if (!list || list.worldId !== world.id) notFound();

  const summary = summarizePrintList(list);
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
                className="uwe-btn uwe-btn-primary"
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
                  className="uwe-btn"
                >
                  PDF exportieren
                </a>
                <a
                  href={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=png`}
                  className="uwe-btn"
                >
                  PNG exportieren
                </a>
              </>
            }
            danger={
              <form action={deletePrintListAction} style={{ display: "inline" }}>
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="printListId" value={printListId} />
                <button type="submit" className="uwe-btn uwe-btn-danger">Löschen</button>
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
      {(saved || created || added || status) && (
        <p className="uwe-flash uwe-flash-success">
          {created
            ? "Druckliste erstellt."
            : added
              ? "Label hinzugefügt."
              : status
                ? `Status: ${LABEL_PRINT_STATUS_LABELS[status as keyof typeof LABEL_PRINT_STATUS_LABELS]}`
                : "Gespeichert."}
        </p>
      )}

      {summary.hasDmOnly && (
        <p className="uwe-flash uwe-flash-warning">
          Diese Druckliste enthält Labels mit DM-only Inhalten.
        </p>
      )}

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
            <button type="submit" className="uwe-btn uwe-btn-primary">Speichern</button>
          </div>
        </form>
      </section>

      <div className="uwe-form-actions">
        <form action={setPrintListStatusAction} style={{ display: "inline" }}>
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="printListId" value={printListId} />
          <input type="hidden" name="status" value="printed" />
          <button type="submit" className="uwe-btn">Als gedruckt markieren</button>
        </form>
      </div>
    </WorldModuleShell>
  );
}
