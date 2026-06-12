import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  analyzeLabelSafety,
  createLabelService,
  createPrintListService,
  getAppRepository,
  LABEL_PRINT_STATUS_LABELS,
  LABEL_SOURCE_TYPE_LABELS,
  normalizeLabel,
} from "@uwe/database/server";
import { worldSidebar } from "../page";
import { LabelEditWorkspace } from "@/components/LabelEditWorkspace";
import {
  addLabelToPrintListAction,
  deleteLabelAction,
  duplicateLabelAction,
  resetLabelToTemplateAction,
  saveLabelAsTemplateAction,
  setLabelPrintStatusAction,
  updateLabelAction,
} from "@/app/label-actions";

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
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={world.name} href="/" />}
      sidebar={worldSidebar(worldSlug, "labels")}
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Labels", href: `/worlds/${worldSlug}/labels` },
              { label: label.title },
            ]}
          />
          <PageHeader
            title={label.title}
            summary={`Quelle: ${LABEL_SOURCE_TYPE_LABELS[label.sourceType]} · Vorlage: ${label.template.name} · Status: ${LABEL_PRINT_STATUS_LABELS[label.printStatus]}`}
            actions={
              <>
                <Link
                  href={`/worlds/${worldSlug}/labels/${labelId}/preview`}
                  className="uwe-btn"
                >
                  Vorschau
                </Link>
                <a
                  href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=print`}
                  className="uwe-btn uwe-btn-primary"
                  target="_blank"
                  rel="noreferrer"
                >
                  Drucken
                </a>
              </>
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
                <legend>Layout & Kürzung</legend>
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
              </fieldset>

              <LabelEditWorkspace
                initialElements={parsed.content.elements ?? []}
                imageAssets={imageAssets}
                originalText={parsed.content.originalText ?? parsed.content.text}
                fitStatus={parsed.content.fitStatus ?? "fits"}
                fitApplied={parsed.content.fitApplied}
                snapToGrid={parsed.layoutSettings.snapToGrid ?? true}
                gridSize={parsed.layoutSettings.gridSize ?? 0.1}
                showSafeArea={parsed.layoutSettings.showSafeArea ?? true}
              />

              <div className="uwe-form-actions">
                <button type="submit" name="action" value="save" className="uwe-btn uwe-btn-primary">
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
                <button type="submit" className="uwe-btn uwe-btn-sm">
                  Zur Druckliste hinzufügen
                </button>
              </form>
            )}
          </section>

          <div className="uwe-form-actions">
            <form action={duplicateLabelAction} style={{ display: "inline" }}>
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="labelId" value={labelId} />
              <button type="submit" className="uwe-btn">Duplizieren</button>
            </form>
            <form action={resetLabelToTemplateAction} style={{ display: "inline" }}>
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="labelId" value={labelId} />
              <button type="submit" className="uwe-btn">Auf Vorlage zurücksetzen</button>
            </form>
            <form action={deleteLabelAction} style={{ display: "inline" }}>
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="labelId" value={labelId} />
              <button type="submit" className="uwe-btn uwe-btn-danger">Löschen</button>
            </form>
            <Link href={`/worlds/${worldSlug}/labels`} className="uwe-btn">
              ← Bibliothek
            </Link>
          </div>
        </>
      }
      context={
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
                <a href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=print`} target="_blank">
                  Druckvorschau
                </a>
              </li>
            </ul>
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
              <button type="submit" className="uwe-btn uwe-btn-sm">Status setzen</button>
            </form>
          </SidebarSection>
          <SidebarSection title="Template">
            <form action={saveLabelAsTemplateAction} className="uwe-form-grid">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="labelId" value={labelId} />
              <input type="text" name="templateName" placeholder="Template-Name" required />
              <button type="submit" className="uwe-btn uwe-btn-sm">Als Template speichern</button>
            </form>
          </SidebarSection>
        </>
      }
    />
  );
}
