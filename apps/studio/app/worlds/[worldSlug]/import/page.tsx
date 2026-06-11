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
      topBar={<TopBarBrand appName="UWE Studio" subtitle={world.name} href="/" />}
      sidebar={
        <>
          <SidebarSection title="Welt">
            <SidebarNav
              items={[
                { label: "← Dashboard", href: "/" },
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
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "KnoteForge Import" },
            ]}
          />
          <PageHeader
            title="KnoteForge Import"
            summary="Daten aus KnoteForge Local importieren — zuerst Vorschau, dann bestätigter Import."
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
            <li>Markdown/HTML folgen in Phase 2.</li>
          </ul>
        </SidebarSection>
      }
    />
  );
}
