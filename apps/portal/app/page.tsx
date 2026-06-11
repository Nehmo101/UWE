import Link from "next/link";
import {
  AppShell,
  TopBarBrand,
} from "@uwe/shared-ui";

export default function PortalHome() {
  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Portal" subtitle="Spieler-Wiki" href="/" />}
      main={
        <section className="uwe-portal-hero">
          <div className="uwe-portal-hero-glow" aria-hidden />
          <p className="uwe-portal-hero-kicker">Universeller Welten-Editor</p>
          <h1>Entdecke die Welten deiner Kampagne</h1>
          <p className="uwe-portal-hero-desc">
            Lore, Orte, NPCs und Handouts — alles was deine Gruppe wissen darf,
            schön aufbereitet und mobil optimiert.
          </p>
          <Link className="uwe-btn uwe-btn-primary" href="/auth/worlds" style={{ marginTop: "1.25rem" }}>
            Mit Anmeldung öffnen
          </Link>
          <p className="uwe-portal-hero-meta" style={{ marginTop: "1rem" }}>
            <Link href="/login">Anmelden</Link>
            {" · "}
            <Link href="/worlds">Demo-Wiki (legacy)</Link>
            {" · "}
            <Link href="/api/health">Health check</Link>
          </p>
        </section>
      }
    />
  );
}
