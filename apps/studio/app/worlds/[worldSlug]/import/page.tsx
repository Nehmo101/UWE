import { notFound } from "next/navigation";
import {
  SidebarSection,
} from "@uwe/shared-ui";
import { getAppRepository } from "@uwe/database/server";
import { importSourceRegistry } from "@uwe/knoteforge-import";
import { WorldModuleShell } from "@/components/WorldModuleShell";
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
    <WorldModuleShell
      worldSlug={worldSlug}
      worldName={world.name}
      activeNav="import"
      breadcrumb={worldSectionBreadcrumb(world.name, worldSlug, "KnoteForge Import", `/worlds/${worldSlug}/import`)}
      pageHeader={{
        title: "KnoteForge Import",
        summary: "Daten aus KnoteForge Local importieren — zuerst Vorschau, dann bestätigter Import.",
      }}
      context={
        <SidebarSection title="Hinweise">
          <ul className="uwe-import-context-list">
            <li>Import ist einseitig (KnoteForge → UWE).</li>
            <li>Die Vorschau schreibt keine Daten.</li>
            <li>Konflikte und Duplikate werden vor dem Import angezeigt.</li>
            <li>Markdown/HTML folgen in Phase 2.</li>
          </ul>
        </SidebarSection>
      }
    >
      <ImportWorkspace
        worldSlug={worldSlug}
        supportedFormats={supportedFormats}
        plannedFormats={plannedFormats}
      />
    </WorldModuleShell>
  );
}
