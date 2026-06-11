import Link from "next/link";
import { BrandHeader } from "@uwe/shared-ui";
import { listWorlds, getWikiStore } from "@uwe/database";

export default function PortalWorldsPage() {
  const store = getWikiStore();
  const worlds = listWorlds(store);

  return (
    <main className="page wiki-world-page">
      <BrandHeader appName="UWE Portal" tagline="Spieler-Wiki" />
      <section className="card wiki-world-grid">
        <h2>Welten</h2>
        {worlds.map((world) => (
          <article key={world.id} className="wiki-world-card">
            <h2>
              <Link href={`/worlds/${world.slug}`}>{world.name}</Link>
            </h2>
            {world.description && <p>{world.description}</p>}
            <Link href={`/worlds/${world.slug}`}>Wiki lesen →</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
