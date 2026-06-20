import Link from "next/link";
import type { UweAuthApp } from "./auth-links";
import { readPublicAppUrls, resolveAuthLinks } from "./auth-links";
import { LogoutButton } from "./LogoutButton";

const LANDING_FEATURES = [
  { label: "Studio", detail: "Weltenbau & Admin-Cockpit" },
  { label: "Portal", detail: "Spieler-Wiki & Handouts" },
  { label: "Lokale KI", detail: "RTX-Inferenz im Heimnetz" },
  { label: "D&D Brain", detail: "Kampagnenwissen & Generatoren" },
] as const;

interface UweLandingPageProps {
  currentApp: UweAuthApp;
  isLoggedIn: boolean;
  userDisplayName?: string | null;
}

export function UweLandingPage({
  currentApp,
  isLoggedIn,
  userDisplayName,
}: UweLandingPageProps) {
  const { studioBaseUrl, portalBaseUrl } = readPublicAppUrls();
  const links = resolveAuthLinks({
    isLoggedIn,
    currentApp,
    studioBaseUrl,
    portalBaseUrl,
  });

  const appLabel = currentApp === "studio" ? "Studio" : "Portal";
  const heroDesc =
    currentApp === "studio"
      ? "Studio für Weltenbau, Kampagnenverwaltung und Spielleitung — self-hosted auf deiner Hardware."
      : "Spieler-Wiki und freigegebene Handouts — gefiltert nach Sichtbarkeit, ohne DM-Leaks.";

  return (
    <main className="uwe-auth-shell uwe-landing-shell" data-auth-variant={currentApp}>
      <div className="uwe-auth-shell-glow" aria-hidden />

      <aside className="uwe-auth-brand uwe-landing-brand" aria-label="UWE Produktinformationen">
        <div className="uwe-auth-brand-inner">
          <p className="uwe-auth-brand-kicker">Universeller Welten-Editor</p>
          <h1 className="uwe-auth-brand-title">
            <span className="uwe-auth-brand-logo" aria-hidden>
              U
            </span>
            WE
          </h1>
          <p className="uwe-auth-brand-subtitle">Unified Web Experience</p>
          <p className="uwe-auth-brand-desc">{heroDesc}</p>

          <ul className="uwe-auth-feature-list">
            {LANDING_FEATURES.map((feature) => (
              <li key={feature.label} className="uwe-auth-feature-item">
                <span className="uwe-auth-feature-label">{feature.label}</span>
                <span className="uwe-auth-feature-detail">{feature.detail}</span>
              </li>
            ))}
          </ul>

          <p className="uwe-auth-brand-meta">
            <span className="uwe-auth-brand-badge">{appLabel}</span>
            <span>Lokal gehostet · Keine Cloud-Abhängigkeit</span>
          </p>
        </div>
      </aside>

      <div className="uwe-auth-content uwe-landing-content">
        <section className="uwe-auth-card uwe-landing-card">
          <header className="uwe-auth-card-header">
            <h1>Willkommen bei UWE</h1>
            <p className="uwe-auth-lead">
              Wähle deinen Einstieg — Studio für Spielleitung und Admin, Portal für Spieler.
            </p>
          </header>

          <div className="uwe-auth-card-body">
            <div className="uwe-landing-actions">
              <Link className="uwe-btn uwe-btn-primary uwe-landing-action" href={links.studioHref}>
                <span className="uwe-landing-action-label">Zum Studio</span>
                <span className="uwe-landing-action-detail">Weltenbau &amp; Admin</span>
              </Link>
              <Link className="uwe-btn uwe-btn-ghost uwe-landing-action" href={links.portalHref}>
                <span className="uwe-landing-action-label">Zum Portal</span>
                <span className="uwe-landing-action-detail">Spieler-Wiki</span>
              </Link>
              {!isLoggedIn ? (
                <Link className="uwe-btn uwe-btn-ghost uwe-landing-action" href={links.loginHref}>
                  <span className="uwe-landing-action-label">Anmelden</span>
                  <span className="uwe-landing-action-detail">Session-Login</span>
                </Link>
              ) : (
                <div className="uwe-landing-action uwe-landing-action-logout">
                  <LogoutButton displayName={userDisplayName ?? undefined} redirectTo="/" />
                </div>
              )}
            </div>

            {isLoggedIn && userDisplayName && (
              <p className="uwe-auth-message uwe-auth-message-success" role="status">
                Angemeldet als {userDisplayName}
              </p>
            )}

            {currentApp === "portal" && (
              <p className="uwe-auth-footer uwe-landing-footer">
                <Link href="/worlds">Demo-Wiki ansehen</Link>
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
