import Link from "next/link";
import type { UweAuthApp } from "./auth-links";
import { readPublicAppUrls, resolveAuthLinks } from "./auth-links";
import { LogoutButton } from "./LogoutButton";

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

  return (
    <main className="uwe-landing-page">
      <section className="uwe-portal-hero uwe-landing-hero">
        <div className="uwe-portal-hero-glow" aria-hidden />
        <p className="uwe-portal-hero-kicker">Universeller Welten-Editor</p>
        <h1>UWE</h1>
        <p className="uwe-portal-hero-desc">
          Studio für Weltenbau, Kampagnenverwaltung und Spielleitung
        </p>
        <div className="uwe-portal-hero-actions">
          <Link className="uwe-btn uwe-btn-primary" href={links.studioHref}>
            Zum Studio
          </Link>
          <Link className="uwe-btn uwe-btn-ghost" href={links.portalHref}>
            Zum Portal
          </Link>
          {!isLoggedIn ? (
            <Link className="uwe-btn uwe-btn-ghost" href={links.loginHref}>
              Anmelden
            </Link>
          ) : (
            <LogoutButton
              displayName={userDisplayName ?? undefined}
              redirectTo="/"
            />
          )}
        </div>
        {isLoggedIn && userDisplayName && (
          <p className="uwe-portal-hero-meta" role="status">
            Angemeldet als {userDisplayName}
          </p>
        )}
        {currentApp === "portal" && (
          <p className="uwe-portal-hero-meta">
            <Link href="/worlds">Demo-Wiki</Link>
          </p>
        )}
      </section>
    </main>
  );
}
