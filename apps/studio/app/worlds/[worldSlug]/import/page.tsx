import { notFound } from "next/navigation";
import {
  SidebarSection,
} from "@uwe/shared-ui";
import { getAppRepository } from "@uwe/database/server";
import { importSourceRegistry } from "@uwe/knoteforge-import";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { ImportWorkspace } from "./ImportWorkspace";
import { WikitextConvertPanel } from "./WikitextConvertPanel";

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
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground">
            <li>Import ist einseitig (KnoteForge → UWE).</li>
            <li>Die Vorschau schreibt keine Daten.</li>
            <li>Konflikte und Duplikate werden vor dem Import angezeigt.</li>
            <li>JSON: strukturierter KnoteForge-Export.</li>
            <li>Markdown/TXT: mehrere Texte, getrennt durch <code>---</code> oder Mehrfachauswahl.</li>
            <li>HTML-Import folgt in einer späteren Phase.</li>
            <li>
              „Alle Wikitexte konvertieren“ verlinkt bestehende Texte und ist über das
              Aktivitätsprotokoll rückgängig machbar.
            </li>
          </ul>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Import & Konvertierung"
        summary="KnoteForge-JSON oder unstrukturierte Texte importieren — zuerst Vorschau, dann bestätigter Import. Bestehende Wikitexte lassen sich gesammelt verlinken und strukturieren."
      />
      <ImportWorkspace
        worldSlug={worldSlug}
        supportedFormats={supportedFormats}
        plannedFormats={plannedFormats}
      />
      <WikitextConvertPanel worldSlug={worldSlug} />
    </WorldShell>
  );
}
