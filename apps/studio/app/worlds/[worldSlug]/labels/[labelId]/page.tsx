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
  createLabelService,
  getAppRepository,
  LABEL_SOURCE_TYPE_LABELS,
  normalizeLabel,
} from "@uwe/database/server";
import { worldSidebar } from "../page";
import {
  duplicateLabelAction,
  deleteLabelAction,
  updateLabelAction,
} from "@/app/label-actions";

interface Props {
  params: Promise<{ worldSlug: string; labelId: string }>;
  searchParams: Promise<{ saved?: string; created?: string; duplicated?: string }>;
}

export default async function StudioLabelEditPage({ params, searchParams }: Props) {
  const { worldSlug, labelId } = await params;
  const { saved, created, duplicated } = await searchParams;
  const repo = getAppRepository();
  const labelService = createLabelService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const label = await labelService.getLabelById(labelId);
  if (!label || label.worldId !== world.id) notFound();

  const templates = await labelService.listTemplates(world.id);
  const parsed = normalizeLabel(label);

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
            summary={`Quelle: ${LABEL_SOURCE_TYPE_LABELS[label.sourceType]} · Vorlage: ${label.template.name}`}
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

          {(saved || created || duplicated) && (
            <p className="uwe-flash uwe-flash-success">
              {created ? "Label erstellt." : duplicated ? "Label dupliziert." : "Gespeichert."}
            </p>
          )}

          {parsed.content.containsDmOnly && (
            <p className="uwe-flash uwe-flash-warning">
              Dieses Label enthält DM-only Inhalte. Beim Export für Spieler vorsichtig sein.
            </p>
          )}

          <section className="uwe-panel">
            <h2>Label bearbeiten</h2>
            <form action={updateLabelAction} className="uwe-form-grid">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="labelId" value={labelId} />

              <label>
                Titel
                <input type="text" name="title" defaultValue={label.title} required />
              </label>

              <label>
                Inhaltstitel
                <input
                  type="text"
                  name="contentTitle"
                  defaultValue={parsed.content.title}
                />
              </label>

              <label>
                Text
                <textarea name="text" rows={8} defaultValue={parsed.content.text} />
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

              <fieldset className="uwe-fieldset">
                <legend>Layout</legend>
                <label>
                  Modus
                  <select name="layoutMode" defaultValue={parsed.layoutSettings.mode}>
                    <option value="image_text">Bild + Text</option>
                    <option value="text_only">Nur Text</option>
                    <option value="image_only">Nur Bild</option>
                  </select>
                </label>
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
              </fieldset>

              <div className="uwe-form-actions">
                <button type="submit" className="uwe-btn uwe-btn-primary">
                  Speichern
                </button>
              </div>
            </form>
          </section>

          <section className="uwe-panel uwe-label-preview-panel">
            <h2>Schnellvorschau</h2>
            <div
              className="uwe-label-preview-frame"
              style={{
                aspectRatio: `${parsed.layoutSettings.widthInches} / ${parsed.layoutSettings.heightInches}`,
              }}
            >
              <div className="uwe-label-preview-card">
                <strong>{parsed.content.title || label.title}</strong>
                {parsed.layoutSettings.mode !== "image_only" && (
                  <p>{parsed.content.text.slice(0, 200)}{parsed.content.text.length > 200 ? "…" : ""}</p>
                )}
                {parsed.layoutSettings.mode !== "text_only" && parsed.content.imageAssetId && (
                  <p className="uwe-table-sub">Bild: {parsed.content.imageAssetId.slice(0, 8)}…</p>
                )}
              </div>
            </div>
          </section>

          <div className="uwe-form-actions">
            <form action={duplicateLabelAction} style={{ display: "inline" }}>
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="labelId" value={labelId} />
              <button type="submit" className="uwe-btn">Duplizieren</button>
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
      }
    />
  );
}
