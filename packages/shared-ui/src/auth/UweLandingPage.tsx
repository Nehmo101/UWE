import Link from "next/link";
import type { UweAuthApp } from "./auth-links";
import { readPublicAppUrls, resolveAuthLinks } from "./auth-links";
import { LogoutButton } from "./LogoutButton";

interface UweLandingPageProps {
  currentApp: UweAuthApp;
  isLoggedIn: boolean;
  userDisplayName?: string | null;
  showSetupLink?: boolean;
  showSystemStatusLink?: boolean;
}

export function UweLandingPage({
  currentApp,
  isLoggedIn,
  userDisplayName,
  showSetupLink = false,
  showSystemStatusLink = false,
}: UweLandingPageProps) {
  const { studioBaseUrl, portalBaseUrl } = readPublicAppUrls();
  const links = resolveAuthLinks({
    isLoggedIn,
    currentApp,
    studioBaseUrl,
    portalBaseUrl,
  });

  const isStudio = currentApp === "studio";
  const appLabel = isStudio ? "Studio" : "Portal";
  const title = isStudio ? "UWE" : "UWE Portal";
  const lead = isStudio
    ? "Self-hosted Kampagnen- und Admin-Cockpit."
    : "Spieleransicht für Welten, Handouts und Sessions.";
  const portalWorldsHref = isStudio ? `${portalBaseUrl.replace(/\/$/, "")}/worlds` : "/worlds";
  const portalMineHref = isStudio ? links.portalHref : isLoggedIn ? "/auth/worlds" : links.loginHref;

  return (
    <main className="uwe-auth-shell uwe-landing-shell" data-auth-variant={currentApp}>
      <div className="uwe-auth-shell-glow" aria-hidden />

      <aside className="uwe-auth-brand uwe-landing-brand" aria-label="UWE Einstieg">
        <div className="uwe-auth-brand-inner">
          <p className="uwe-auth-brand-kicker">Universeller Welten-Editor</p>
          <h1 className="uwe-auth-brand-title">
            <span className="uwe-auth-brand-logo" aria-hidden>
              U
            </span>
            WE
          </h1>
          <p className="uwe-auth-brand-desc">{lead}</p>
          <p className="uwe-auth-brand-meta">
            <span className="uwe-auth-brand-badge">{appLabel}</span>
            <span>Lokal gehostet</span>
          </p>
        </div>
      </aside>

      <div className="uwe-auth-content uwe-landing-content">
        <section className="uwe-auth-card uwe-landing-card">
          <header className="uwe-auth-card-header">
            <h1>{title}</h1>
            <p className="uwe-auth-lead">
              {isStudio
                ? "Wähle den passenden Einstieg für Verwaltung oder Spieleransicht."
                : "Öffne deine freigegebenen Welten oder stöbere in öffentlichen Inhalten."}
            </p>
          </header>

          <div className="uwe-auth-card-body">
            <div className="uwe-landing-actions">
              {isStudio ? (
                <>
                  <Link className="uwe-v2-btn uwe-v2-btn-primary uwe-landing-action" href={links.studioHref}>
                    <span className="uwe-landing-action-label">Studio öffnen</span>
                    <span className="uwe-landing-action-detail">Verwalten, erstellen, prüfen</span>
                  </Link>
                  <Link className="uwe-v2-btn uwe-v2-btn-secondary uwe-landing-action" href={links.portalHref}>
                    <span className="uwe-landing-action-label">Portal öffnen</span>
                    <span className="uwe-landing-action-detail">Spieleransicht</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link className="uwe-v2-btn uwe-v2-btn-primary uwe-landing-action" href={portalMineHref}>
                    <span className="uwe-landing-action-label">Meine Welten</span>
                    <span className="uwe-landing-action-detail">Freigegebene Inhalte</span>
                  </Link>
                  <Link className="uwe-v2-btn uwe-v2-btn-secondary uwe-landing-action" href={portalWorldsHref}>
                    <span className="uwe-landing-action-label">Welten entdecken</span>
                    <span className="uwe-landing-action-detail">Öffentliche Ansicht</span>
                  </Link>
                </>
              )}
            </div>

            <div className="uwe-landing-actions uwe-landing-actions-secondary">
              {!isLoggedIn ? (
                <Link className="uwe-v2-btn uwe-v2-btn-subtle" href={links.loginHref}>
                  Anmelden
                </Link>
              ) : (
                <LogoutButton
                  className="uwe-v2-btn uwe-v2-btn-subtle"
                  displayName={userDisplayName ?? undefined}
                  redirectTo="/"
                />
              )}
              {isStudio && showSetupLink ? (
                <Link className="uwe-v2-btn uwe-v2-btn-subtle" href="/setup">
                  Setup
                </Link>
              ) : null}
              {isStudio && showSystemStatusLink ? (
                <Link className="uwe-v2-btn uwe-v2-btn-subtle" href="/system">
                  Systemstatus
                </Link>
              ) : null}
              {!isStudio ? (
                <Link className="uwe-v2-btn uwe-v2-btn-ghost" href={links.studioHref}>
                  Studio öffnen
                </Link>
              ) : null}
            </div>

            {isLoggedIn && userDisplayName ? (
              <p className="uwe-auth-message uwe-auth-message-success" role="status">
                Angemeldet als {userDisplayName}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
