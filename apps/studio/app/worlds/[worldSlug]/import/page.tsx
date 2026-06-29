import { notFound } from "next/navigation";
import {
  SidebarSection,
} from "@uwe/shared-ui";
import { getAppRepository } from "@uwe/database/server";
import { importSourceRegistry } from "@uwe/knoteforge-import";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { ImportWorkspace } from "./ImportWorkspace";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function StudioImportPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const supportedFormats = importSourceRegistry.supportedFormats();
  const plannedFormats = importSourceRegistry.plannedFormats();

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "Import", `/worlds/${worldSlug}/import`)}
        />
      }
      contextPanel={
        <SidebarSection title="Hinweise">
          <ul className="uwe-import-context-list">
            <li>Import ist einseitig (KnoteForge → UWE).</li>
            <li>Die Vorschau schreibt keine Daten.</li>
            <li>Konflikte und Duplikate werden vor dem Import angezeigt.</li>
            <li>JSON: strukturierter KnoteForge-Export.</li>
            <li>Markdown/TXT: mehrere Texte, getrennt durch <code>---</code> oder Mehrfachauswahl.</li>
            <li>HTML-Import folgt in einer späteren Phase.</li>
          </ul>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Import"
        summary="KnoteForge-JSON oder unstrukturierte Texte importieren — zuerst Vorschau, dann bestätigter Import."
      />
      <ImportWorkspace
        worldSlug={worldSlug}
        supportedFormats={supportedFormats}
        plannedFormats={plannedFormats}
      />
    </WorldShell>
  );
}
