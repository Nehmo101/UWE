import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SidebarSection,
} from "@uwe/shared-ui";
import {
  createLabelService,
  getAppRepository,
  normalizeLabel,
  renderLabelHtml,
} from "@uwe/database/server";
import { WorldModuleShell } from "@/components/WorldModuleShell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";

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
    <WorldModuleShell
      worldSlug={worldSlug}
      worldName={world.name}
      activeNav="labels"
      backLink={{ label: "← Bearbeiten", href: `/worlds/${worldSlug}/labels/${labelId}` }}
      breadcrumb={worldDetailBreadcrumb(
        world.name,
        worldSlug,
        "Labels",
        `/worlds/${worldSlug}/labels`,
        label.title,
        `/worlds/${worldSlug}/labels/${labelId}`,
      ).concat({ label: "Vorschau" })}
      pageHeader={{
        title: "Druckvorschau",
        summary: "6×4 Zoll — Browser-Druck oder Export als PDF/HTML.",
        actions: (
          <>
            <a
              href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=print`}
              className="uwe-v2-btn uwe-v2-btn-primary"
              target="_blank"
              rel="noreferrer"
            >
              Drucken
            </a>
            <Link href={`/worlds/${worldSlug}/labels/${labelId}`} className="uwe-v2-btn">
              Bearbeiten
            </Link>
          </>
        ),
      }}
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
    >
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
        />
      </section>
    </WorldModuleShell>
  );
}
