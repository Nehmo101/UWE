import Link from "next/link";
import {
  PAGE_TYPE_LABELS,
  VISIBILITY_LABELS,
} from "@uwe/shared-ui";
import { createPageTemplateService, prisma } from "@uwe/database/server";
import {
  duplicateTemplateAction,
  setTemplateActiveAction,
} from "../template-actions";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";

interface Props {
  searchParams: Promise<{ error?: string; type?: string; q?: string }>;
}

export default async function TemplatesPage({ searchParams }: Props) {
  const { error, type: typeFilter, q: query } = await searchParams;
  const templates = await createPageTemplateService(prisma).listTemplates({
    includeInactive: true,
  });

  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  const filtered = templates.filter((template) => {
    if (typeFilter && template.pageType !== typeFilter) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return (
      template.name.toLowerCase().includes(normalizedQuery) ||
      template.slug.toLowerCase().includes(normalizedQuery)
    );
  });

  const pageTypes = [...new Set(templates.map((template) => template.pageType))].sort();

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Seiten-Templates" }]} />}>
      <PageHeader
        title="Seiten-Templates"
        summary="Vorlagen für Quick Create — System-Templates lassen sich anpassen und deaktivieren, eigene Templates frei verwalten."
      />
      {error && (
        <p className="uwe-form-error" role="alert">{error}</p>
      )}

      <form method="get" className="uwe-form" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Kategorie (Seitentyp)</span>
          <select name="type" defaultValue={typeFilter ?? ""} className="rounded border border-input bg-background px-3 py-2 text-sm">
            <option value="">Alle Typen</option>
            {pageTypes.map((pageType) => (
              <option key={pageType} value={pageType}>
                {PAGE_TYPE_LABELS[pageType as keyof typeof PAGE_TYPE_LABELS] ?? pageType}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm" style={{ minWidth: "14rem", flex: 1 }}>
          <span className="text-muted-foreground">Suche</span>
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Name oder Slug…"
            className="rounded border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Filtern
          </button>
          {(typeFilter || normalizedQuery) && (
            <Link href="/templates" className="uwe-v2-btn">
              Zurücksetzen
            </Link>
          )}
        </div>
      </form>

      <p>
        <Link className="uwe-v2-btn uwe-v2-btn-primary" href="/templates/new">
          Neues Template
        </Link>
      </p>

      <table className="uwe-page-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Seitentyp</th>
            <th>Standard-Sichtbarkeit</th>
            <th>Blöcke</th>
            <th>Status</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={6} className="uwe-v2-empty">
                Keine Templates für diesen Filter.
              </td>
            </tr>
          ) : (
            filtered.map((template) => (
            <tr key={template.id}>
              <td>
                <Link href={`/templates/${template.id}`}>{template.name}</Link>
                {template.isSystem && (
                  <span className="uwe-badge" style={{ marginLeft: "0.4rem" }}>System</span>
                )}
              </td>
              <td>{PAGE_TYPE_LABELS[template.pageType]}</td>
              <td>{VISIBILITY_LABELS[template.defaultVisibility]}</td>
              <td>{template.blocks.length}</td>
              <td>{template.isActive ? "Aktiv" : "Deaktiviert"}</td>
              <td>
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                  <form action={duplicateTemplateAction}>
                    <input type="hidden" name="templateId" value={template.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-sm">
                      Duplizieren
                    </button>
                  </form>
                  <form action={setTemplateActiveAction}>
                    <input type="hidden" name="templateId" value={template.id} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={template.isActive ? "false" : "true"}
                    />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-sm">
                      {template.isActive ? "Deaktivieren" : "Aktivieren"}
                    </button>
                  </form>
                </div>
              </td>
            </tr>
            ))
          )}
        </tbody>
      </table>
    </StudioShell>
  );
}
