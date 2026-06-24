import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SidebarSection,
} from "@uwe/shared-ui";
import {
  createWorldOverviewService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { WorldCockpitShell } from "@/components/WorldCockpitShell";
import { worldCockpitTabItems } from "@/src/lib/studio-navigation";
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

  const quickCreate = [
    { label: "+ NPC", href: `/worlds/${worldSlug}/pages/new?template=npc` },
    { label: "+ Ort", href: `/worlds/${worldSlug}/pages/new?template=ort` },
    { label: "+ Fraktion", href: `/worlds/${worldSlug}/pages/new?template=fraktion` },
    { label: "+ Quest", href: `/worlds/${worldSlug}/pages/new?template=quest` },
    { label: "+ Handout", href: `/worlds/${worldSlug}/pages/new?template=handout` },
    { label: "+ Session", href: `/worlds/${worldSlug}/sessions/new` },
  ];

  const cockpitTabs = worldCockpitTabItems(worldSlug, "overview");

  return (
    <WorldCockpitShell
      worldSlug={worldSlug}
      worldName={world.name}
      activeNav="overview"
      breadcrumb={[]}
      hideBreadcrumb
      contextTitle="Quick Create"
      context={
        <>
          <SidebarSection title="Schnell erstellen">
            <div className="uwe-quick-create">
              {quickCreate.map((action) => (
                <Link key={action.href} className="uwe-v2-btn uwe-v2-btn-ghost" href={action.href}>
                  {action.label}
                </Link>
              ))}
            </div>
          </SidebarSection>

          <SidebarSection title="Portal-Status">
            <ul className="uwe-sidebar-links">
              <li>
                Portal: <strong>{overview.portal.portalEnabled ? "aktiv" : "deaktiviert"}</strong>
              </li>
              <li>
                Sichtbare Seiten: <strong>{overview.portal.visiblePageCount}</strong>
              </li>
              <li>
                Aktive Share-Links: <strong>{overview.portal.activeShareLinkCount}</strong>
              </li>
              <li>
                Gastmodus: <strong>{overview.world.guestModeEnabled ? "an" : "aus"}</strong>
              </li>
              <li>
                <Link href={`/worlds/${worldSlug}/inspector`}>Inspektor öffnen →</Link>
              </li>
            </ul>
          </SidebarSection>

          {overview.playerNotesForReview > 0 && (
            <SidebarSection title="Spielernotizen">
              <ul className="uwe-sidebar-links">
                <li>
                  <Link href={`/worlds/${worldSlug}/notes`}>
                    {overview.playerNotesForReview}{" "}
                    {overview.playerNotesForReview === 1 ? "Notiz wartet" : "Notizen warten"} auf
                    Review →
                  </Link>
                </li>
              </ul>
            </SidebarSection>
          )}
        </>
      }
    >
      <WorldDashboardClient
        worldSlug={worldSlug}
        worldName={world.name}
        worldDescription={world.description}
        cockpitTabs={cockpitTabs}
        overview={{
          counts: overview.counts,
          portal: overview.portal,
          world: overview.world,
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
            visibility: page.visibility,
            publishStatus: page.publishStatus,
            updatedAt: page.updatedAt.toISOString(),
          })),
        }}
      />
    </WorldCockpitShell>
  );
}
