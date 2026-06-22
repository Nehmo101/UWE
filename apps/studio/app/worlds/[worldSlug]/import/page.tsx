import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import { getAppRepository } from "@uwe/database/server";
import { importSourceRegistry } from "@uwe/knoteforge-import";
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
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={world.name} href="/studio" />}
      sidebar={
        <>
          <SidebarSection title="Welt">
            <SidebarNav
              items={[
                { label: "← Dashboard", href: "/studio" },
                { label: "Seiten", href: `/worlds/${worldSlug}` },
                { label: "Import", href: `/worlds/${worldSlug}/import`, active: true },
                { label: "Dungeons", href: `/worlds/${worldSlug}/dungeons` },
                { label: "Assets", href: `/worlds/${worldSlug}/assets` },
                { label: "Labels", href: `/worlds/${worldSlug}/labels` },
                { label: "Sessions", href: `/worlds/${worldSlug}/sessions` },
                { label: "Soundboard", href: `/worlds/${worldSlug}/soundboard` },
                { label: "Neue Seite", href: `/worlds/${worldSlug}/pages/new` },
              ]}
            />
          </SidebarSection>
        </>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/studio" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Import" },
            ]}
          />
          <PageHeader
            title="Import"
            summary="KnoteForge-JSON oder unstrukturierte Texte importieren — zuerst Vorschau, dann bestätigter Import."
          />

          <ImportWorkspace
            worldSlug={worldSlug}
            supportedFormats={supportedFormats}
            plannedFormats={plannedFormats}
          />
        </>
      }
      context={
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
    />
  );
}
