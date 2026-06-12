import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  EmptyState,
  GAME_SESSION_STATUS_LABELS,
  GlobalSearchForm,
  PageHeader,
  PageTypeBadge,
  PublishBadge,
  SidebarNav,
  SidebarSection,
  StatGrid,
  TopBarBrand,
  VisibilityBadge,
} from "@uwe/shared-ui";
import {
  buildPageUrl,
  createWorldOverviewService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { worldNavItems } from "@/src/lib/world-nav";

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

  return (
    <AppShell
      topBar={
        <>
          <TopBarBrand appName="UWE Studio" subtitle={world.name} href="/" />
          <GlobalSearchForm
            action={`/worlds/${worldSlug}`}
            query=""
            placeholder="In dieser Welt suchen…"
          />
        </>
      }
      sidebar={
        <SidebarSection title="Welt">
          <SidebarNav items={[{ label: "← Dashboard", href: "/" }, ...worldNavItems(worldSlug, "overview")]} />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Übersicht" },
            ]}
          />

          <PageHeader
            title={world.name}
            summary={world.description}
            actions={
              <Link className="uwe-btn uwe-btn-primary" href={`/worlds/${worldSlug}/pages/new`}>
                Seite erstellen
              </Link>
            }
          />

          <StatGrid
            stats={[
              { label: "Seiten", value: overview.counts.pages },
              { label: "NPCs", value: overview.counts.byCategory.npcs },
              { label: "Orte", value: overview.counts.byCategory.orte },
              { label: "Fraktionen", value: overview.counts.byCategory.fraktionen },
              { label: "Sessions", value: overview.counts.gameSessions },
              {
                label: "Im Portal sichtbar",
                value: overview.portal.visiblePageCount,
                hint: `${overview.counts.drafts} Entwürfe`,
              },
            ]}
          />

          <div className="uwe-dashboard-grid">
            <section className="uwe-card uwe-dashboard-card">
              <h2 className="uwe-section-title">Nächste Session</h2>
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
                  <Link
                    className="uwe-btn uwe-btn-ghost"
                    href={`/worlds/${worldSlug}/sessions/${overview.nextSession.id}`}
                  >
                    Session vorbereiten →
                  </Link>
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
            </section>

            <section className="uwe-card uwe-dashboard-card">
              <h2 className="uwe-section-title">Offene Plots</h2>
              {overview.openPlots.length === 0 ? (
                <p className="uwe-dashboard-muted">
                  Keine offenen Plots notiert. Pflege sie in deinen Sessions unter „Offene Plots&ldquo;.
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
            </section>

            <section className="uwe-card uwe-dashboard-card uwe-dashboard-card-wide">
              <h2 className="uwe-section-title">Zuletzt bearbeitet</h2>
              {overview.recentPages.length === 0 ? (
                <EmptyState
                  title="Noch keine Seiten"
                  action={
                    <Link className="uwe-btn uwe-btn-primary" href={`/worlds/${worldSlug}/pages/new`}>
                      Erste Seite erstellen
                    </Link>
                  }
                />
              ) : (
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
              )}
            </section>
          </div>
        </>
      }
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
    />
  );
}
