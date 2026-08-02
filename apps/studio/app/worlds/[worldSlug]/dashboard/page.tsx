import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarSection } from "@uwe/shared-ui";
import {
  createWorldOverviewService,
  getAppRepository,
  getDefaultDashboardLayout,
  prisma,
  studioWorldDashboardPageKey,
} from "@uwe/database/server";
import { ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { worldRootBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { worldDmToolQuickLinks } from "@/src/lib/studio-navigation";
import { WorldDashboardClient } from "./WorldDashboardClient";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function WorldDashboardPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const overview = await createWorldOverviewService(prisma).getWorldOverview(worldSlug);
  if (!overview) notFound();

  const dashboardWidgets = getDefaultDashboardLayout(studioWorldDashboardPageKey(worldSlug));

  const quickCreate = [
    { label: "+ NPC", href: `/worlds/${worldSlug}/pages/new?template=npc` },
    { label: "+ Ort", href: `/worlds/${worldSlug}/pages/new?template=ort` },
    { label: "+ Fraktion", href: `/worlds/${worldSlug}/pages/new?template=fraktion` },
    { label: "+ Quest", href: `/worlds/${worldSlug}/pages/new?template=quest` },
    { label: "+ Handout", href: `/worlds/${worldSlug}/pages/new?template=handout` },
    { label: "+ Session", href: `/worlds/${worldSlug}/sessions/new` },
  ];

  const dmTools = worldDmToolQuickLinks(worldSlug);

  return (
    <>
      <ShellBreadcrumb items={[...worldRootBreadcrumb(world.name, worldSlug), { label: "Übersicht" }]} />
      <ShellContextPanel>
        <SidebarSection title="Schnell erstellen">
          <div className="flex flex-col gap-1">
            {quickCreate.map((action) => (
              <Link
                key={action.href}
                className="rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                href={action.href}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </SidebarSection>

        <SidebarSection title="DM-Werkzeuge">
          <div className="flex flex-col gap-1">
            {dmTools.map((tool) => (
              <Link
                key={tool.href}
                className="rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                href={tool.href}
              >
                {tool.label}
              </Link>
            ))}
          </div>
        </SidebarSection>

        <SidebarSection title="Portal-Status">
          <ul className="space-y-1 text-sm">
            <li>
              Portal: <strong>{overview.portal.portalEnabled ? "aktiv" : "deaktiviert"}</strong>
            </li>
            <li>
              Sichtbare Seiten: <strong>{overview.portal.visiblePageCount}</strong>
            </li>
            <li>
              <Link href={`/worlds/${worldSlug}/inspector`} className="hover:underline">
                Inspektor öffnen →
              </Link>
            </li>
          </ul>
        </SidebarSection>

        {overview.playerNotesForReview > 0 && (
          <SidebarSection title="Spielernotizen">
            <ul className="text-sm">
              <li>
                <Link href={`/worlds/${worldSlug}/notes`} className="hover:underline">
                  {overview.playerNotesForReview}{" "}
                  {overview.playerNotesForReview === 1 ? "Notiz wartet" : "Notizen warten"} auf
                  Review →
                </Link>
              </li>
            </ul>
          </SidebarSection>
        )}
      </ShellContextPanel>
      {/*
        Hier stand ein `PageHeader` mit demselben Titel und derselben
        Beschreibung, die `WorldCockpitHeader` unten schon trägt: der Weltname
        stand zweimal untereinander, beide Male als `h1`. Ein Screenreader
        meldete zwei Seitenüberschriften, und wer die Seite ansah, las die
        Weltbeschreibung doppelt.
      */}
      <WorldDashboardClient
        worldSlug={worldSlug}
        worldName={world.name}
        worldDescription={world.description}
        widgets={dashboardWidgets}
        overview={{
          counts: overview.counts,
          portal: overview.portal,
          nextSession: overview.nextSession
            ? {
                id: overview.nextSession.id,
                sessionNumber: overview.nextSession.sessionNumber,
                title: overview.nextSession.title,
                date: overview.nextSession.date?.toISOString() ?? null,
                status: overview.nextSession.status,
              }
            : null,
          openPlots: overview.openPlots,
          recentPages: overview.recentPages.map((page) => ({
            id: page.id,
            title: page.title,
            slug: page.slug,
            type: page.type,
            updatedAt: page.updatedAt.toISOString(),
          })),
        }}
      />
    </>
  );
}
