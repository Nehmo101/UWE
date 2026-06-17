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
          <p className="uwe-dashboard-muted">
            Nutze den Anmeldebereich für private Spielerbereiche. Das Demo-Wiki zeigt nur
            Inhalte, die bewusst öffentlich oder spielersicher freigegeben sind.
          </p>
          <div className="uwe-portal-hero-actions">
            <Link className="uwe-btn uwe-btn-primary" href="/auth/worlds">
              Mit Anmeldung öffnen
            </Link>
            <Link className="uwe-btn uwe-btn-ghost" href="/login">
              Anmelden
            </Link>
          </div>
          <p className="uwe-portal-hero-meta">
            <Link href="/worlds">Demo-Wiki</Link>
            {" · "}
            <Link href="/api/health">Health check</Link>
          </p>
        </section>
      }
    />
  );
}
