import { BrandHeader } from "@uwe/shared-ui";

export default function StudioHomePage() {
  return (
    <main className="page">
      <BrandHeader
        appName="UWE Studio"
        tagline="Self-hosted campaign brain and world wiki"
      />
      <section className="card">
        <h2>Campaign Editor</h2>
        <p>
          Manage worlds, campaigns, NPCs, locations, and DM-only knowledge in
          one structured workspace.
        </p>
        <ul>
          <li>World and campaign management</li>
          <li>Wiki-style linking with backlinks</li>
          <li>Clear separation of DM and player knowledge</li>
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
