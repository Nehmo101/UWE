import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EmptyState,
  GAME_SESSION_STATUS_LABELS,
  PageTypeBadge,
  PublishBadge,
  SidebarSection,
  VisibilityBadge,
  WorldCockpitCard,
  WorldCockpitGrid,
  WorldCockpitHeader,
  WorldCockpitTabs,
  WorldCockpitTag,
} from "@uwe/shared-ui";
import {
  buildPageUrl,
  createWorldOverviewService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { WorldCockpitShell } from "@/components/WorldCockpitShell";
import { worldCockpitTabItems } from "@/src/lib/studio-navigation";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "full",
});

const RELATIVE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
                <Link key={action.href} className="uwe-btn uwe-btn-ghost" href={action.href}>
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
      <WorldCockpitHeader
        title={world.name}
        summary={world.description}
        tags={
          <>
            <WorldCockpitTag variant="accent">Welt-Cockpit</WorldCockpitTag>
            <WorldCockpitTag>{overview.counts.pages} Seiten</WorldCockpitTag>
            <WorldCockpitTag>{overview.counts.campaigns} Kampagnen</WorldCockpitTag>
            <WorldCockpitTag variant="muted">
              {overview.portal.visiblePageCount} im Portal
            </WorldCockpitTag>
          </>
        }
        actions={
          <Link className="uwe-btn uwe-btn-primary" href={`/worlds/${worldSlug}/pages/new`}>
            Seite erstellen
          </Link>
        }
      />

      <WorldCockpitTabs items={cockpitTabs} />

      <WorldCockpitGrid>
        <WorldCockpitCard title="Nächste Session">
          {overview.nextSession ? (
            <>
              <p className="uwe-dashboard-highlight">
                <Link href={`/worlds/${worldSlug}/sessions/${overview.nextSession.id}`}>
                  #{overview.nextSession.sessionNumber} — {overview.nextSession.title}
                </Link>
              </p>
              <p className="uwe-dashboard-muted">
                {overview.nextSession.date
                  ? DATE_FORMAT.format(overview.nextSession.date)
                  : "Noch kein Termin"}{" "}
                · {GAME_SESSION_STATUS_LABELS[overview.nextSession.status]}
              </p>
            </>
          ) : (
            <EmptyState
              title="Keine Session geplant"
              action={
                <Link className="uwe-btn uwe-btn-primary" href={`/worlds/${worldSlug}/sessions/new`}>
                  Session planen
                </Link>
              }
            />
          )}
        </WorldCockpitCard>

        <WorldCockpitCard title="Offene Plots">
          {overview.openPlots.length === 0 ? (
            <p className="uwe-dashboard-muted">
              Keine offenen Plots notiert. Pflege sie in deinen Sessions unter „Offene Plots“.
            </p>
          ) : (
            <ul className="uwe-dashboard-list">
              {overview.openPlots.map((plot) => (
                <li key={plot.sessionId}>
                  <Link href={`/worlds/${worldSlug}/sessions/${plot.sessionId}`}>
                    Session #{plot.sessionNumber}
                  </Link>
                  <p>{plot.openPlots}</p>
                </li>
              ))}
            </ul>
          )}
        </WorldCockpitCard>

        <WorldCockpitCard title="Wiki & Seiten">
          <p className="uwe-cockpit-stat-line">
            <strong>{overview.counts.pages}</strong> Seiten gesamt
          </p>
          <p className="uwe-dashboard-muted">
            {overview.counts.byCategory.npcs} NPCs · {overview.counts.byCategory.orte} Orte ·{" "}
            {overview.counts.drafts} Entwürfe
          </p>
          <Link className="uwe-btn uwe-btn-ghost" href={`/worlds/${worldSlug}`}>
            Seitenliste →
          </Link>
        </WorldCockpitCard>

        <WorldCockpitCard title="Portal & Sharing">
          <p className="uwe-cockpit-stat-line">
            <strong>{overview.portal.visiblePageCount}</strong> sichtbare Seiten
          </p>
          <p className="uwe-dashboard-muted">
            {overview.portal.activeShareLinkCount} Share-Links · Portal{" "}
            {overview.portal.portalEnabled ? "aktiv" : "aus"}
          </p>
          <Link className="uwe-btn uwe-btn-ghost" href={`/worlds/${worldSlug}/inspector`}>
            Inspektor →
          </Link>
        </WorldCockpitCard>

        <WorldCockpitCard title="Medien & Assets">
          <p className="uwe-cockpit-stat-line">
            <strong>{overview.counts.assets}</strong> Assets
          </p>
          <p className="uwe-dashboard-muted">
            Karten, Handouts und Uploads für diese Welt.
          </p>
          <Link className="uwe-btn uwe-btn-ghost" href={`/worlds/${worldSlug}/assets`}>
            Medien öffnen →
          </Link>
        </WorldCockpitCard>

        <WorldCockpitCard title="KI & Brain">
          <p className="uwe-cockpit-stat-line">
            <strong>{overview.counts.gameSessions}</strong> Sessions
          </p>
          <p className="uwe-dashboard-muted">
            Brain Store, KI-Läufe und Generator-Werkzeuge.
          </p>
          <div className="uwe-cockpit-card-actions">
            <Link className="uwe-btn uwe-btn-ghost" href={`/worlds/${worldSlug}/brain`}>
              Brain →
            </Link>
            <Link className="uwe-btn uwe-btn-ghost" href={`/worlds/${worldSlug}/ai-runs`}>
              KI-Läufe →
            </Link>
          </div>
        </WorldCockpitCard>
      </WorldCockpitGrid>

      {overview.recentPages.length > 0 && (
        <section className="uwe-card uwe-cockpit-recent">
          <h2 className="uwe-section-title">Zuletzt bearbeitet</h2>
          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Typ</th>
                <th>Sichtbarkeit</th>
                <th>Publish</th>
                <th>Geändert</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentPages.map((page) => (
                <tr key={page.id}>
                  <td>
                    <Link href={buildPageUrl(worldSlug, page.type, page.slug)}>
                      {page.title}
                    </Link>
                  </td>
                  <td><PageTypeBadge type={page.type} /></td>
                  <td><VisibilityBadge visibility={page.visibility} /></td>
                  <td><PublishBadge status={page.publishStatus} /></td>
                  <td className="uwe-dashboard-muted">
                    {RELATIVE_FORMAT.format(page.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </WorldCockpitShell>
  );
}
