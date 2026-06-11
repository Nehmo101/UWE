import Link from "next/link";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SearchField,
  SidebarNav,
  SidebarSection,
  StatGrid,
  TopBarBrand,
} from "@uwe/shared-ui";
import { getAppRepository } from "@uwe/database/server";

export default async function StudioDashboard() {
  const repo = getAppRepository();
  const [stats, worlds] = await Promise.all([
    repo.getDashboardStats(),
    repo.listWorlds(),
  ]);

  return (
    <AppShell
      topBar={
        <>
          <TopBarBrand appName="UWE Studio" subtitle="Dungeon Master Workspace" />
          <SearchField action="/worlds" placeholder="Welten durchsuchen…" />
        </>
      }
      sidebar={
        <>
          <SidebarSection title="Navigation">
            <SidebarNav
              items={[
                { label: "Dashboard", href: "/", active: true },
                { label: "Welten", href: "/worlds" },
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

          <section style={{ marginTop: "2rem" }}>
            <h2 style={{ fontSize: "1rem", color: "#94a3b8", marginBottom: "1rem" }}>
              Deine Welten
            </h2>
            <div className="wiki-world-grid">
              {worlds.map((world) => (
                <article key={world.id} className="wiki-world-card">
                  <h2>{world.name}</h2>
                  {world.description && <p>{world.description}</p>}
                  <Link href={`/worlds/${world.slug}`}>Welt öffnen →</Link>
                </article>
              ))}
            </div>
          </section>
        </>
      }
      context={
        <SidebarSection title="Schnellstart">
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem" }}>
            <li style={{ marginBottom: "0.5rem" }}>
              <Link href="/worlds">Welten auswählen</Link>
            </li>
            <li style={{ marginBottom: "0.5rem" }}>Kampagne wählen & Seiten bearbeiten</li>
            <li>Vorschau als Spieler testen</li>
          </ul>
        </SidebarSection>
      }
    />
  );
}
