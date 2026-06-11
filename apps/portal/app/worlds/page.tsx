import Link from "next/link";
import {
  AppShell,
  PageHeader,
  TopBarBrand,
} from "@uwe/shared-ui";
import { getAppRepository } from "@uwe/database/server";

export default async function PortalWorldsPage() {
  const worlds = await getAppRepository().listWorlds();

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Portal" subtitle="Welten" href="/" />}
      main={
        <>
          <PageHeader
            title="Welten"
            summary="Wähle eine Welt und erkunde veröffentlichte Inhalte."
          />
          <div className="wiki-world-grid">
            {worlds.map((world) => (
              <article key={world.id} className="wiki-world-card">
                <h2>{world.name}</h2>
                {world.description && <p>{world.description}</p>}
                <Link href={`/worlds/${world.slug}`}>Welt betreten →</Link>
              </article>
            ))}
          </div>
        </>
      }
    />
  );
}
