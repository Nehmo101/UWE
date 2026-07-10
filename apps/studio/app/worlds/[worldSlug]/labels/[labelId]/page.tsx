import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContextActions,
  SidebarSection,
} from "@uwe/shared-ui";
import {
  analyzeLabelExportWarnings,
  analyzeLabelSafety,
  createLabelService,
  createPrintListService,
  getAppRepository,
  LABEL_PRINT_STATUS_LABELS,
  LABEL_SOURCE_TYPE_LABELS,
  normalizeLabel,
} from "@uwe/database/server";
import { isLabelAiShortenAvailable } from "@/src/lib/label-ai-shorten";
import { LabelEditWorkspace } from "@/components/LabelEditWorkspace";
import {
  deleteLabelAction,
  duplicateLabelAction,
  resetLabelToTemplateAction,
  saveLabelAsTemplateAction,
  setLabelPrintStatusAction,
  updateLabelAction,
} from "@/app/label-actions";
import { addLabelToPrintListAction } from "@/app/print-list-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string; labelId: string }>;
  searchParams: Promise<{
    saved?: string;
    created?: string;
    duplicated?: string;
    reset?: string;
    status?: string;
  }>;
}

export default async function StudioLabelEditPage({ params, searchParams }: Props) {
  const { worldSlug, labelId } = await params;
  const { saved, created, duplicated, reset, status } = await searchParams;
  const repo = getAppRepository();
  const labelService = createLabelService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const label = await labelService.getLabelById(labelId);
  if (!label || label.worldId !== world.id) notFound();

  const templates = await labelService.listTemplates(world.id);
  const lists = await createPrintListService().listByWorld(worldSlug);
  const parsed = normalizeLabel(label);
  const safety = analyzeLabelSafety(parsed.content, parsed.content.elements);
  const exportWarnings = analyzeLabelExportWarnings(parsed.content, parsed.layoutSettings);
  const assets = await repo.listAssetsByWorld(worldSlug);
  const imageAssets = assets
    .filter((a) => a.mimeType?.startsWith("image/"))
    .map((a) => ({
      id: a.id,
      title: a.title,
      url: `/api/assets/${a.id}/file`,
      visibility: a.visibility,
    }));

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
            `/worlds/${worldSlug}/labels`,
            label.title,
            `/worlds/${worldSlug}/labels/${labelId}`,
          )}
        />
      }
      contextPanel={
        <>
          <SidebarSection title="Export">
            <ul className="uwe-sidebar-links">
              <li>
                <a href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=html`}>
                  HTML exportieren
                </a>
              </li>
              <li>
                <a href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=pdf`}>
                  PDF exportieren
                </a>
              </li>
              <li>
                <a href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=png`}>
                  PNG exportieren
                </a>
              </li>
              <li>
                <a href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=print`} target="_blank">
                  Druckvorschau
                </a>
              </li>
            </ul>
            <p className="uwe-table-sub" style={{ marginTop: "0.75rem" }}>
              PDF-Fallback: Bei Fehlern liefert der Server Print-HTML mit Header{" "}
              <code>X-UWE-Export-Fallback: 1</code> — Grund steht in{" "}
              <code>X-UWE-Export-Fallback-Reason</code>.
            </p>
          </SidebarSection>
          <SidebarSection title="Druckstatus">
            <form action={setLabelPrintStatusAction} className="uwe-form-grid">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="labelId" value={labelId} />
              <select name="status" defaultValue={label.printStatus}>
                <option value="open">Offen</option>
                <option value="exported">Exportiert</option>
                <option value="printed">Gedruckt</option>
                <option value="archived">Archiviert</option>
              </select>
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-sm">Status setzen</button>
            </form>
          </SidebarSection>
          <SidebarSection title="Template">
            <form action={saveLabelAsTemplateAction} className="uwe-form-grid">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="labelId" value={labelId} />
              <input type="text" name="templateName" placeholder="Template-Name" required />
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-sm">Als Template speichern</button>
            </form>
          </SidebarSection>
        </>
      }
    >
      <PageHeader
        title={label.title}
        summary={`Quelle: ${LABEL_SOURCE_TYPE_LABELS[label.sourceType]} · Vorlage: ${label.template.name} · Status: ${LABEL_PRINT_STATUS_LABELS[label.printStatus]}`}
        actions={
          <ContextActions
            secondary={
              <>
                <Link
                  href={`/worlds/${worldSlug}/labels/${labelId}/preview`}
                  className="uwe-v2-btn"
                >
                  Vorschau
                </Link>
                <a
                  href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=print`}
                  className="uwe-v2-btn uwe-v2-btn-primary"
                  target="_blank"
                  rel="noreferrer"
                >
                  Drucken
                </a>
              </>
            }
            danger={
              <form action={deleteLabelAction} style={{ display: "inline" }}>
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="labelId" value={labelId} />
                <button type="submit" className="uwe-v2-btn uwe-v2-btn-danger">Löschen</button>
              </form>
            }
          />
        }
      />
      {(saved || created || duplicated || reset || status) && (
        <p className="uwe-flash uwe-flash-success">
          {created
            ? "Label erstellt."
            : duplicated
              ? "Label dupliziert."
              : reset
                ? "Layout auf Vorlage zurückgesetzt."
                : status
                  ? `Status: ${LABEL_PRINT_STATUS_LABELS[status as keyof typeof LABEL_PRINT_STATUS_LABELS] ?? status}`
                  : "Gespeichert."}
        </p>
      )}

      {safety.warnings.map((warning) => (
        <p key={warning.code} className="uwe-flash uwe-flash-warning">
          {warning.message}
        </p>
      ))}

      {exportWarnings.map((warning) => (
        <p key={`export-${warning.code}-${warning.message}`} className="uwe-flash uwe-flash-warning">
          Export: {warning.message}
        </p>
      ))}

      <section className="uwe-panel">
        <h2>Druckvorbereitung</h2>
        <p className="uwe-table-sub">
          Vorschau im Druckformat (6×4 Zoll) — prüfe Safe Area und Kürzung vor dem Export.
        </p>
        <iframe
          title="Label Druckvorbereitung"
          src={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=print`}
          className="uwe-label-preview-iframe"
          style={{ minHeight: "14rem" }}
        />
      </section>

      <section className="uwe-panel">
        <h2>Visueller Label-Editor</h2>
        <form action={updateLabelAction} className="uwe-form-grid">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="labelId" value={labelId} />

          <div className="uwe-form-row uwe-form-row-2">
            <label>
              Titel
              <input type="text" name="title" defaultValue={label.title} required />
            </label>
            <label>
              Vorlage
              <select name="templateId" defaultValue={label.templateId}>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <input type="hidden" name="contentTitle" value={parsed.content.title} />
          <input type="hidden" name="text" value={parsed.content.text} />

          <fieldset className="uwe-fieldset">
            <legend>Layout &amp; Kürzung</legend>
            <div className="uwe-form-row uwe-form-row-3">
              <label>
                Modus
                <select name="layoutMode" defaultValue={parsed.layoutSettings.mode}>
                  <option value="image_text">Bild + Text</option>
                  <option value="text_only">Nur Text</option>
                  <option value="image_only">Nur Bild</option>
                </select>
              </label>
              <label>
                Kürzmodus
                <select name="fitMode" defaultValue={parsed.layoutSettings.fitMode ?? "normal"}>
                  <option value="conservative">Konservativ</option>
                  <option value="normal">Normal</option>
                  <option value="aggressive">Aggressiv</option>
                </select>
              </label>
              <label className="uwe-checkbox">
                <input
                  type="checkbox"
                  name="snapToGrid"
                  defaultChecked={parsed.layoutSettings.snapToGrid ?? true}
                />
                Snap-to-Grid (0.1 in)
              </label>
            </div>
            <label className="uwe-checkbox">
              <input
                type="checkbox"
                name="truncateToPage"
                defaultChecked={parsed.layoutSettings.truncateToPage}
              />
              Inhalt auf eine Seite kürzen
            </label>
            <label className="uwe-checkbox">
              <input
                type="checkbox"
                name="truncateLongWords"
                defaultChecked={parsed.layoutSettings.truncateLongWords}
              />
              Lange Wörter kürzen
            </label>
            <label className="uwe-checkbox">
              <input
                type="checkbox"
                name="showSafeArea"
                defaultChecked={parsed.layoutSettings.showSafeArea ?? true}
              />
              Safe Area anzeigen
            </label>
            <label className="uwe-checkbox">
              <input
                type="checkbox"
                name="showCropMarks"
                defaultChecked={parsed.layoutSettings.showCropMarks ?? false}
              />
              Schnittmarken im Export
            </label>
          </fieldset>

          <LabelEditWorkspace
            initialElements={parsed.content.elements ?? []}
            imageAssets={imageAssets}
            worldSlug={worldSlug}
            originalText={parsed.content.originalText ?? parsed.content.text}
            currentText={parsed.content.text ?? ""}
            fitStatus={parsed.content.fitStatus ?? "fits"}
            fitApplied={parsed.content.fitApplied}
            snapToGrid={parsed.layoutSettings.snapToGrid ?? true}
            gridSize={parsed.layoutSettings.gridSize ?? 0.1}
            showSafeArea={parsed.layoutSettings.showSafeArea ?? true}
            aiAvailable={isLabelAiShortenAvailable()}
          />

          <div className="uwe-form-actions">
            <button type="submit" name="action" value="save" className="uwe-v2-btn uwe-v2-btn-primary">
              Speichern
            </button>
          </div>
        </form>
      </section>

      <section className="uwe-panel">
        <h2>Druckliste</h2>
        {lists.length === 0 ? (
          <p className="uwe-table-sub">
            Noch keine Drucklisten.{" "}
            <Link href={`/worlds/${worldSlug}/labels?tab=print-lists`}>Druckliste erstellen</Link>
          </p>
        ) : (
          <form action={addLabelToPrintListAction} className="uwe-form-inline">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="labelId" value={labelId} />
            <select name="printListId" required>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
            <input type="number" name="copies" defaultValue={1} min={1} max={99} style={{ width: "4rem" }} />
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-sm">
              Zur Druckliste hinzufügen
            </button>
          </form>
        )}
      </section>

      <div className="uwe-form-actions">
        <form action={duplicateLabelAction} style={{ display: "inline" }}>
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="labelId" value={labelId} />
          <button type="submit" className="uwe-v2-btn">Duplizieren</button>
        </form>
        <form action={resetLabelToTemplateAction} style={{ display: "inline" }}>
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="labelId" value={labelId} />
          <button type="submit" className="uwe-v2-btn">Auf Vorlage zurücksetzen</button>
        </form>
      </div>
    </WorldShell>
  );
}
