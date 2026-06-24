import {
  buildNextActions,
  createActivityLogService,
  getAppRepository,
  getProductionSafetyWarnings,
  prisma,
} from "@uwe/database/server";
import { StudioCockpitAppShell } from "@/components/StudioCockpitAppShell";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
import { STUDIO_DASHBOARD_PATH } from "@/src/lib/routes";
import { StudioDashboardClient } from "./StudioDashboardClient";
import Link from "next/link";
import { SidebarSection } from "@uwe/shared-ui";

interface Props {
  searchParams: Promise<{ undoApplied?: string; undoError?: string }>;
}

export default async function StudioDashboard({ searchParams }: Props) {
  const { undoApplied, undoError } = await searchParams;
  const repo = getAppRepository();
  const [stats, worlds, recentPages, activityEntries, nextActions, productionWarnings] =
    await Promise.all([
      repo.getDashboardStats(),
      repo.listWorlds(),
      repo.listRecentlyEditedPages(6),
      createActivityLogService(prisma).list({ limit: 15 }),
      buildNextActions(prisma),
      getProductionSafetyWarnings(prisma),
    ]);

  const criticalProductionWarnings = productionWarnings.filter(
    (warning) => warning.severity === "critical",
  );

  return (
    <StudioCockpitAppShell
      variant="dashboard"
      activePath={STUDIO_DASHBOARD_PATH}
      showRail
      showSearch
      railActiveId="more"
      title="Dashboard"
      summary="Verwalte Welten, Kampagnen und Wiki-Seiten mit vollem DM-Zugriff."
      bottomNav={studioGlobalBottomNav("more")}
      contextTitle="Schnellaktionen"
      context={
        <SidebarSection title="Schnellaktionen">
          <ul className="uwe-sidebar-links">
            <li>
              <Link href="/worlds">Welten auswählen</Link>
            </li>
            <li>
              <Link href="/search">Globale Suche</Link>
            </li>
            <li>
              <Link href="/backup">Backup erstellen</Link>
            </li>
            <li>
              <Link href="/settings">Einstellungen</Link>
            </li>
          </ul>
        </SidebarSection>
      }
    >
      <StudioDashboardClient
        stats={stats}
        worlds={worlds.map((world) => ({
          id: world.id,
          name: world.name,
          slug: world.slug,
          description: world.description,
        }))}
        recentPages={recentPages.map((page) => ({
          id: page.id,
          title: page.title,
          slug: page.slug,
          type: page.type,
          publishStatus: page.publishStatus,
          world: { name: page.world.name, slug: page.world.slug },
        }))}
        activityEntries={activityEntries.map((entry) => ({
          id: entry.id,
          createdAt: entry.createdAt.toISOString(),
          action: entry.action,
          summary: entry.summary,
          targetHref: entry.targetHref,
          undo: entry.undo
            ? {
                entryId: entry.undo.entryId,
                undoneAt: entry.undo.undoneAt?.toISOString() ?? null,
              }
            : null,
        }))}
        nextActions={nextActions.map((action) => ({
          id: action.id,
          title: action.title,
          description: action.description,
          href: action.href,
          severity: action.severity,
        }))}
        criticalProductionWarnings={criticalProductionWarnings.map((warning) => ({
          id: warning.id,
          title: warning.title,
          description: warning.description,
          href: warning.href,
        }))}
        undoApplied={undoApplied}
        undoError={undoError}
      />
    </StudioCockpitAppShell>
  );
}
