import { BrandHeader } from "@uwe/shared-ui";

export default function PortalHomePage() {
  return (
    <main className="page">
      <BrandHeader
        appName="UWE Portal"
        tagline="Self-hosted campaign brain and world wiki"
      />
      <section className="card">
        <h2>Player Portal</h2>
        <p>
          Browse campaign lore, locations, factions, and handouts shared by your
          Dungeon Master — without spoilers from DM-only notes.
        </p>
        <ul>
          <li>Player-safe wiki pages</li>
          <li>Handouts and session recaps</li>
          <li>Linked world knowledge</li>
        </ul>
      </section>
      <footer className="footer">
        <a href="/api/health">Health check</a>
        <span>·</span>
        <span>Phase 1 — Initial setup</span>
      </footer>
    </main>
  );
}
