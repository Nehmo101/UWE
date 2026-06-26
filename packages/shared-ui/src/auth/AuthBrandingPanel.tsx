import type { AuthUiVariant } from "./AuthPageLayout";

const STUDIO_POINTS = [
  { label: "Studio", detail: "Welten, Inhalte und System" },
  { label: "Portal", detail: "Spieleransicht separat" },
] as const;

const PORTAL_POINTS = [
  { label: "Welten", detail: "Für dich freigegeben" },
  { label: "Sessions", detail: "Recaps und Handouts" },
] as const;

interface AuthBrandingPanelProps {
  variant: AuthUiVariant;
}

export function AuthBrandingPanel({ variant }: AuthBrandingPanelProps) {
  const points = variant === "studio" ? STUDIO_POINTS : PORTAL_POINTS;
  const appLabel = variant === "studio" ? "Studio" : "Portal";

  return (
    <aside className="uwe-auth-brand" aria-label="UWE Einstieg">
      <div className="uwe-auth-brand-inner">
        <p className="uwe-auth-brand-kicker">Universeller Welten-Editor</p>
        <h1 className="uwe-auth-brand-title">
          <span className="uwe-auth-brand-logo" aria-hidden>
            U
          </span>
          WE
        </h1>
        <p className="uwe-auth-brand-desc">
          {variant === "studio"
            ? "Self-hosted Kampagnen- und Admin-Cockpit für deine eigene Infrastruktur."
            : "Spielerportal für freigegebene Kampagneninhalte."}
        </p>

        <ul className="uwe-auth-feature-list">
          {points.map((point) => (
            <li key={point.label} className="uwe-auth-feature-item">
              <span className="uwe-auth-feature-label">{point.label}</span>
              <span className="uwe-auth-feature-detail">{point.detail}</span>
            </li>
          ))}
        </ul>

        <p className="uwe-auth-brand-meta">
          <span className="uwe-auth-brand-badge">{appLabel}</span>
          <span>Lokal gehostet</span>
        </p>
      </div>
    </aside>
  );
}
