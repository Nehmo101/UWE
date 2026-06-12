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
  normalizeLabel,
  renderLabelHtml,
} from "@uwe/database/server";
import { worldSidebar } from "../../page";

interface Props {
  params: Promise<{ worldSlug: string; labelId: string }>;
  searchParams: Promise<{ includeDmOnly?: string }>;
}

export default async function StudioLabelPreviewPage({ params, searchParams }: Props) {
  const { worldSlug, labelId } = await params;
  const { includeDmOnly } = await searchParams;
  const repo = getAppRepository();
  const labelService = createLabelService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const label = await labelService.getLabelById(labelId);
  if (!label || label.worldId !== world.id) notFound();

  const parsed = normalizeLabel(label);
  const imageUrls: Record<string, string> = {};
  if (parsed.content.imageAssetId) {
    imageUrls[parsed.content.imageAssetId] = `/api/assets/${parsed.content.imageAssetId}/file`;
  }
  for (const el of parsed.content.elements ?? []) {
    if (el.imageAssetId) {
      imageUrls[el.imageAssetId] = `/api/assets/${el.imageAssetId}/file`;
    }
  }

  const html = renderLabelHtml(
    {
      content: parsed.content,
      layoutSettings: parsed.layoutSettings,
      title: label.title,
      imageUrl: parsed.content.imageAssetId
        ? imageUrls[parsed.content.imageAssetId]
        : null,
      imageUrls,
      worldName: world.name,
      includeDmOnly: includeDmOnly === "1",
    },
    true,
  );

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
              { label: label.title, href: `/worlds/${worldSlug}/labels/${labelId}` },
              { label: "Vorschau" },
            ]}
          />
          <PageHeader
            title="Druckvorschau"
            summary="6×4 Zoll — Browser-Druck oder Export als PDF/HTML."
            actions={
              <>
                <a
                  href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=print`}
                  className="uwe-btn uwe-btn-primary"
                  target="_blank"
                  rel="noreferrer"
                >
                  Drucken
                </a>
                <Link href={`/worlds/${worldSlug}/labels/${labelId}`} className="uwe-btn">
                  Bearbeiten
                </Link>
              </>
            }
          />

          {parsed.content.containsDmOnly && includeDmOnly !== "1" && (
            <p className="uwe-flash uwe-flash-warning">
              Enthält DM-only Inhalte.{" "}
              <Link href={`?includeDmOnly=1`}>In Vorschau anzeigen</Link>
            </p>
          )}

          <section className="uwe-panel">
            <iframe
              title="Label Vorschau"
              srcDoc={html}
              className="uwe-label-preview-iframe"
              style={{ width: "100%", minHeight: "420px", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "0.5rem", background: "#fff" }}
            />
          </section>
        </>
      }
      context={
        <SidebarSection title="Export">
          <ul className="uwe-sidebar-links">
            <li>
              <a href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=html`}>
                HTML herunterladen
              </a>
            </li>
            <li>
              <a href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=pdf`}>
                PDF herunterladen
              </a>
            </li>
          </ul>
        </SidebarSection>
      }
    />
  );
}
