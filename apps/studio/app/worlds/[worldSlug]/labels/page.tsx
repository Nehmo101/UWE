import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SidebarSection,
} from "@uwe/shared-ui";
import {
  createLabelService,
  createPrintListService,
  getAppRepository,
  LABEL_PRINT_STATUS_LABELS,
  LABEL_SOURCE_TYPE_LABELS,
  normalizeLabel,
  summarizePrintList,
} from "@uwe/database/server";
import {
  deleteTemplateAction,
  duplicateLabelAction,
  duplicateTemplateAction,
  renameTemplateAction,
} from "@/app/label-actions";
import { createPrintListAction } from "@/app/print-list-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{
    deleted?: string;
    duplicated?: string;
    tab?: string;
    templateSaved?: string;
    renamed?: string;
  }>;
}

export default async function StudioLabelsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { deleted, duplicated, tab, templateSaved, renamed } = await searchParams;
  const activeTab = tab === "templates" ? "templates" : tab === "print-lists" ? "print-lists" : "labels";

  const repo = getAppRepository();
  const labelService = createLabelService();
  const printListService = createPrintListService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const labelRows = await labelService.listLabelsByWorld(worldSlug);
  const templates = await labelService.listTemplates(world.id);
  const worldTemplates = templates.filter((t) => t.worldId === world.id);
  const printLists = await printListService.listByWorld(worldSlug);

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "Labels", `/worlds/${worldSlug}/labels`)}
        />
      }
      contextPanel={
        <SidebarSection title="Kontext">
          <p className="uwe-hint" style={{ margin: 0 }}>
            {labelRows.length} Labels · {printLists.length} Drucklisten · Format 6×4 Zoll
          </p>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Label-Bibliothek"
        summary="6×4 Zoll Labels, Karten und Handouts erstellen, bearbeiten und drucken."
        actions={
          <Link href={`/worlds/${worldSlug}/labels/new`} className="uwe-v2-btn uwe-v2-btn-primary">
            Neues Label
          </Link>
        }
      />
      {(deleted || duplicated || templateSaved || renamed) && (
        <p className="uwe-flash uwe-flash-success">
          {deleted
            ? "Gelöscht."
            : duplicated
              ? "Dupliziert."
              : templateSaved
                ? "Template gespeichert."
                : renamed
                  ? "Template umbenannt."
                  : "Erfolgreich."}
        </p>
      )}

      <details className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <summary className="uwe-v2-section-title" style={{ cursor: "pointer" }}>
          Druck-Workflow — Kurzanleitung
        </summary>
        <ol className="uwe-hint" style={{ paddingLeft: "1.25rem" }}>
          <li>Label erstellen oder aus Seite/Handout generieren</li>
          <li>Druckliste anlegen und Labels hinzufügen</li>
          <li>PDF exportieren oder über RTX-Druck senden</li>
        </ol>
      </details>

      <nav className="uwe-tabs" aria-label="Label-Bereiche">
        <Link
          href={`/worlds/${worldSlug}/labels`}
          className={activeTab === "labels" ? "uwe-tab is-active" : "uwe-tab"}
        >
          Labels ({labelRows.length})
        </Link>
        <Link
          href={`/worlds/${worldSlug}/labels?tab=templates`}
          className={activeTab === "templates" ? "uwe-tab is-active" : "uwe-tab"}
        >
          Templates ({templates.length})
        </Link>
        <Link
          href={`/worlds/${worldSlug}/labels?tab=print-lists`}
          className={activeTab === "print-lists" ? "uwe-tab is-active" : "uwe-tab"}
        >
          Drucklisten ({printLists.length})
        </Link>
        <Link href={`/worlds/${worldSlug}/labels/print`} className="uwe-tab">RTX-Druck</Link>
      </nav>

      {activeTab === "labels" && (
        <>
          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Quelle</th>
                <th>Vorlage</th>
                <th>Status</th>
                <th>Aktualisiert</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {labelRows.map((label) => {
                const parsed = normalizeLabel(label);
                return (
                  <tr key={label.id}>
                    <td>
                      <strong>{label.title}</strong>
                      {parsed.content.containsDmOnly && (
                        <p className="uwe-table-sub uwe-text-warning">Enthält DM-only Inhalte</p>
                      )}
                    </td>
                    <td>
                      {LABEL_SOURCE_TYPE_LABELS[label.sourceType]}
                    </td>
                    <td>{label.template.name}</td>
                    <td>{LABEL_PRINT_STATUS_LABELS[label.printStatus]}</td>
                    <td>{label.updatedAt.toLocaleDateString("de-DE")}</td>
                    <td className="uwe-table-actions">
                      <Link href={`/worlds/${worldSlug}/labels/${label.id}`}>Bearbeiten</Link>
                      <Link href={`/worlds/${worldSlug}/labels/${label.id}/preview`}>Vorschau</Link>
                      <form action={duplicateLabelAction} style={{ display: "inline" }}>
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="labelId" value={label.id} />
                        <button type="submit" className="uwe-link-btn">Duplizieren</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {labelRows.length === 0 && (
            <p className="uwe-v2-empty">
              Noch keine Labels.{" "}
              <Link href={`/worlds/${worldSlug}/labels/new`}>Erstes Label erstellen</Link>
            </p>
          )}
        </>
      )}

      {activeTab === "templates" && (
        <>
          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Typ</th>
                <th>Beschreibung</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td><strong>{template.name}</strong></td>
                  <td>{template.isSystem ? "System" : "Welt"}</td>
                  <td>{template.description ?? "—"}</td>
                  <td className="uwe-table-actions">
                    {!template.isSystem && (
                      <>
                        <form action={renameTemplateAction} style={{ display: "inline-flex", gap: "0.25rem" }}>
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="templateId" value={template.id} />
                          <input type="text" name="name" defaultValue={template.name} style={{ width: "8rem" }} />
                          <button type="submit" className="uwe-link-btn">Umbenennen</button>
                        </form>
                        <form action={deleteTemplateAction} style={{ display: "inline" }}>
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="templateId" value={template.id} />
                          <button type="submit" className="uwe-link-btn uwe-text-warning">Löschen</button>
                        </form>
                      </>
                    )}
                    <form action={duplicateTemplateAction} style={{ display: "inline" }}>
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="templateId" value={template.id} />
                      <button type="submit" className="uwe-link-btn">Duplizieren</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {worldTemplates.length === 0 && templates.length > 0 && (
            <p className="uwe-table-sub">
              Nur System-Templates vorhanden. Speichere ein Label als Template, um eigene Vorlagen anzulegen.
            </p>
          )}
        </>
      )}

      {activeTab === "print-lists" && (
        <>
          <section className="uwe-panel">
            <h2>Neue Druckliste</h2>
            <form action={createPrintListAction} className="uwe-form-inline">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="text" name="name" placeholder="Name" required />
              <input type="text" name="description" placeholder="Beschreibung (optional)" />
              <label className="uwe-checkbox">
                <input type="checkbox" name="forNextSession" />
                Für nächste Session
              </label>
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">Erstellen</button>
            </form>
          </section>

          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Labels</th>
                <th>Kopien</th>
                <th>Status</th>
                <th>Erstellt</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {printLists.map((list) => {
                const summary = summarizePrintList(list);
                return (
                  <tr key={list.id}>
                    <td>
                      <strong>{list.name}</strong>
                      {list.forNextSession && (
                        <p className="uwe-table-sub">Für nächste Session</p>
                      )}
                      {summary.hasDmOnly && (
                        <p className="uwe-table-sub uwe-text-warning">Enthält DM-only Labels</p>
                      )}
                    </td>
                    <td>{summary.labelCount}</td>
                    <td>{summary.totalCopies}</td>
                    <td>{LABEL_PRINT_STATUS_LABELS[list.status]}</td>
                    <td>{list.createdAt.toLocaleDateString("de-DE")}</td>
                    <td className="uwe-table-actions">
                      <Link href={`/worlds/${worldSlug}/labels/print-lists/${list.id}`}>
                        Öffnen
                      </Link>
                      <a href={`/api/worlds/${worldSlug}/print-lists/${list.id}/export?format=print`} target="_blank">
                        Drucken
                      </a>
                      <a href={`/api/worlds/${worldSlug}/print-lists/${list.id}/export?format=pdf`}>
                        PDF
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {printLists.length === 0 && (
            <p className="uwe-v2-empty">Noch keine Drucklisten.</p>
          )}
        </>
      )}
    </WorldShell>
  );
}
