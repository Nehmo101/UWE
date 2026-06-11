import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  createLabelService,
  getAppRepository,
  LABEL_SOURCE_TYPE_LABELS,
  normalizeLabel,
} from "@uwe/database/server";
import { duplicateLabelAction } from "@/app/label-actions";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ deleted?: string; duplicated?: string }>;
}

function worldSidebar(worldSlug: string, active: "labels" | "pages" | "assets") {
  return (
    <SidebarSection title="Welt">
      <SidebarNav
        items={[
          { label: "← Dashboard", href: "/" },
          { label: "Seiten", href: `/worlds/${worldSlug}`, active: active === "pages" },
          { label: "Assets", href: `/worlds/${worldSlug}/assets`, active: active === "assets" },
          { label: "Labels", href: `/worlds/${worldSlug}/labels`, active: active === "labels" },
          { label: "Neue Seite", href: `/worlds/${worldSlug}/pages/new` },
        ]}
      />
    </SidebarSection>
  );
}

export default async function StudioLabelsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { deleted, duplicated } = await searchParams;
  const repo = getAppRepository();
  const labelService = createLabelService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const labelRows = await labelService.listLabelsByWorld(worldSlug);

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
              { label: "Labels" },
            ]}
          />
          <PageHeader
            title="Label-Bibliothek"
            summary="6×4 Zoll Labels, Karten und Handouts erstellen, bearbeiten und drucken."
            actions={
              <Link href={`/worlds/${worldSlug}/labels/new`} className="uwe-btn uwe-btn-primary">
                Neues Label
              </Link>
            }
          />

          {(deleted || duplicated) && (
            <p className="uwe-flash uwe-flash-success">
              {deleted ? "Label gelöscht." : "Label dupliziert."}
            </p>
          )}

          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Quelle</th>
                <th>Vorlage</th>
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
                      {label.sourceId && (
                        <p className="uwe-table-sub">{label.sourceId.slice(0, 8)}…</p>
                      )}
                    </td>
                    <td>{label.template.name}</td>
                    <td>{label.updatedAt.toLocaleDateString("de-DE")}</td>
                    <td className="uwe-table-actions">
                      <Link href={`/worlds/${worldSlug}/labels/${label.id}`}>Bearbeiten</Link>
                      <Link href={`/worlds/${worldSlug}/labels/${label.id}/preview`}>Vorschau</Link>
                      <form action={duplicateLabelAction} style={{ display: "inline" }}>
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="labelId" value={label.id} />
                        <button type="submit" className="uwe-link-btn">
                          Duplizieren
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {labelRows.length === 0 && (
            <p className="uwe-empty">
              Noch keine Labels.{" "}
              <Link href={`/worlds/${worldSlug}/labels/new`}>Erstes Label erstellen</Link>
            </p>
          )}
        </>
      }
      context={
        <SidebarSection title="Kontext">
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0 }}>
            {labelRows.length} Labels · Format 6×4 Zoll
          </p>
        </SidebarSection>
      }
    />
  );
}

export { worldSidebar };
