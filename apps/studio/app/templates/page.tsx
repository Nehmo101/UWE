import Link from "next/link";
import {
  AppShell,
  Breadcrumb,
  PAGE_TYPE_LABELS,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
  VISIBILITY_LABELS,
} from "@uwe/shared-ui";
import { createPageTemplateService, prisma } from "@uwe/database/server";
import {
  duplicateTemplateAction,
  setTemplateActiveAction,
} from "../template-actions";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function TemplatesPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const templates = await createPageTemplateService(prisma).listTemplates({
    includeInactive: true,
  });

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Templates" href="/" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "Dashboard", href: "/" },
              { label: "Welten", href: "/worlds" },
              { label: "Templates", href: "/templates", active: true },
              { label: "Backup", href: "/backup" },
              { label: "Einstellungen", href: "/settings" },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Templates" }]} />

          <PageHeader
            title="Seiten-Templates"
            summary="Vorlagen für Quick Create — System-Templates lassen sich anpassen und deaktivieren, eigene Templates frei verwalten."
          />

          {error && (
            <p className="uwe-form-error" role="alert">{error}</p>
          )}

          <p>
            <Link className="uwe-btn uwe-btn-primary" href="/templates/new">
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
              {templates.map((template) => (
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
                        <button type="submit" className="uwe-btn uwe-btn-small">
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
                        <button type="submit" className="uwe-btn uwe-btn-small">
                          {template.isActive ? "Deaktivieren" : "Aktivieren"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      }
    />
  );
}
