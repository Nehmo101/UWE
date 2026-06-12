import Link from "next/link";
import {
  AppShell,
  EmptyState,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import { getAppRepository } from "@uwe/database/server";

export default async function WorldsPage() {
  const worlds = await getAppRepository().listWorlds();

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Welten" href="/" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "Dashboard", href: "/" },
              { label: "Welten", href: "/worlds", active: true },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <PageHeader title="Welten" summary="Wähle eine Welt für Kampagne und Wiki-Bearbeitung." />
          {worlds.length === 0 ? (
            <EmptyState
              title="Noch keine Welten"
              description="Lege deine erste Welt per Datenbank-Seed oder Import an — danach erscheint sie hier zur Bearbeitung."
              action={
                <Link className="uwe-btn uwe-btn-primary" href="/">
                  Zum Dashboard
                </Link>
              }
            />
          ) : (
            <div className="wiki-world-grid">
              {worlds.map((world) => (
                <article key={world.id} className="wiki-world-card">
                  <h2>{world.name}</h2>
                  {world.description && <p>{world.description}</p>}
                  <Link href={`/worlds/${world.slug}/dashboard`}>Welt verwalten →</Link>
                </article>
              ))}
            </div>
          )}
        </>
      }
    />
  );
}
