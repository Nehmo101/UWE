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
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { Alert, buttonVariants, Card, CardContent } from "@/src/components/ui";

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
          ).concat({ label: "Vorschau" })}
        />
      }
      contextPanel={
        <SidebarSection title="Export">
          <ul className="flex flex-col gap-2 text-sm">
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
      <PageHeader
        title="Druckvorschau"
        summary="6×4 Zoll — Browser-Druck oder Export als PDF/HTML."
        actions={
          <>
            <a
              href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=print`}
              className={buttonVariants()}
              target="_blank"
              rel="noreferrer"
            >
              Drucken
            </a>
            <Link href={`/worlds/${worldSlug}/labels/${labelId}`} className={buttonVariants({ variant: "outline" })}>
              Bearbeiten
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-6">
        {parsed.content.containsDmOnly && includeDmOnly !== "1" && (
          <Alert tone="warning">
            Enthält DM-only Inhalte. <Link href={`?includeDmOnly=1`}>In Vorschau anzeigen</Link>
          </Alert>
        )}

        <Card>
          <CardContent className="p-6">
            {/* Label-Print-Ausnahme (Theme-Policy, Kopf von packages/shared-ui/src/uwe.css):
                die WYSIWYG-Druckvorschau bleibt auf fixer Papierfarbe und wird bewusst nicht
                auf Tokens umgestellt — migriert ist nur die Card-Hülle drumherum, analog zu
                labels/[labelId]/page.tsx. */}
            <iframe
              title="Label Vorschau"
              srcDoc={html}
              sandbox=""
              className="uwe-label-preview-iframe"
            />
          </CardContent>
        </Card>
      </div>
    </WorldShell>
  );
}
