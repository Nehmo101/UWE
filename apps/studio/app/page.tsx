import Link from "next/link";
import {
  AppShell,
  EmptyState,
  PageHeader,
  PageTypeBadge,
  PublishBadge,
  SearchField,
  SidebarNav,
  SidebarSection,
  StatGrid,
  TopBarBrand,
} from "@uwe/shared-ui";
import { buildPageUrl, getAppRepository } from "@uwe/database/server";

export default async function StudioDashboard() {
  const repo = getAppRepository();
  const [stats, worlds, recentPages] = await Promise.all([
    repo.getDashboardStats(),
    repo.listWorlds(),
    repo.listRecentlyEditedPages(6),
  ]);

  return (
    <AppShell
      topBar={
        <>
          <TopBarBrand appName="UWE Studio" subtitle="Dungeon Master Workspace" />
          <SearchField action="/search" placeholder="Global suchen…" />
        </>
      }
      sidebar={
        <>
          <SidebarSection title="Navigation">
            <SidebarNav
              items={[
                { label: "Dashboard", href: "/", active: true },
                { label: "Welten", href: "/worlds" },
                { label: "Backup", href: "/backup" },
                { label: "Einstellungen", href: "/settings" },
              ]}
            />
          </SidebarSection>
        </>
      }
      main={
        <>
          <PageHeader
            title="Dashboard"
            summary="Verwalte Welten, Kampagnen und Wiki-Seiten mit vollem DM-Zugriff."
          />

          <StatGrid
            stats={[
              { label: "Welten", value: stats.worldCount },
              { label: "Seiten gesamt", value: stats.pageCount },
              { label: "Veröffentlicht", value: stats.publishedCount },
              { label: "Entwürfe", value: stats.draftCount },
            ]}
          />

          {recentPages.length > 0 && (
            <section className="uwe-section">
              <h2 className="uwe-section-title">Zuletzt bearbeitet</h2>
              <table className="uwe-page-table">
                <thead>
                  <tr>
                    <th>Titel</th>
                    <th>Welt</th>
                    <th>Typ</th>
                    <th>Publish</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPages.map((page) => (
                    <tr key={page.id}>
                      <td>
                        <Link href={buildPageUrl(page.world.slug, page.type, page.slug)}>
                          {page.title}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/worlds/${page.world.slug}`}>{page.world.name}</Link>
                      </td>
                      <td><PageTypeBadge type={page.type} /></td>
                      <td><PublishBadge status={page.publishStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="uwe-section">
            <h2 className="uwe-section-title">Deine Welten</h2>
            {worlds.length === 0 ? (
              <EmptyState
                title="Noch keine Welten"
                description="Erstelle deine erste Kampagne oder führe db:seed aus, um Demo-Inhalte zu laden."
                action={
                  <Link className="uwe-btn uwe-btn-primary" href="/worlds">
                    Welten verwalten
                  </Link>
                }
              />
            ) : (
              <div className="wiki-world-grid">
                {worlds.map((world) => (
                  <article key={world.id} className="wiki-world-card uwe-card">
                    <h2>{world.name}</h2>
                    {world.description && <p>{world.description}</p>}
                    <Link className="uwe-card-link" href={`/worlds/${world.slug}/dashboard`}>
                      Welt öffnen →
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      }
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
    />
  );
}
