import type { AuthUiVariant } from "./AuthPageLayout";

const STUDIO_FEATURES = [
  { label: "Studio", detail: "Weltenbau & Admin" },
  { label: "Portal", detail: "Spieler-Wiki" },
  { label: "Lokale KI", detail: "RTX-Inferenz" },
  { label: "D&D Brain", detail: "Kampagnenwissen" },
] as const;

const PORTAL_FEATURES = [
  { label: "Portal", detail: "Spieler-Wiki" },
  { label: "Studio", detail: "Spielleitung" },
  { label: "Handouts", detail: "Freigegebene Inhalte" },
  { label: "Session-Recaps", detail: "Spielberichte" },
] as const;

interface AuthBrandingPanelProps {
  variant: AuthUiVariant;
}

export function AuthBrandingPanel({ variant }: AuthBrandingPanelProps) {
  const features = variant === "studio" ? STUDIO_FEATURES : PORTAL_FEATURES;
  const appLabel = variant === "studio" ? "Studio" : "Portal";

  return (
    <aside className="uwe-auth-brand" aria-label="UWE Produktinformationen">
      <div className="uwe-auth-brand-inner">
        <p className="uwe-auth-brand-kicker">Universeller Welten-Editor</p>
        <h1 className="uwe-auth-brand-title">
          <span className="uwe-auth-brand-logo" aria-hidden>
            U
          </span>
          WE
        </h1>
        <p className="uwe-auth-brand-subtitle">Unified Web Experience</p>
        <p className="uwe-auth-brand-desc">
          Self-hosted Alltags- und Hobby-Betriebssystem — deine Daten bleiben auf deiner Hardware.
          {variant === "studio"
            ? " Melde dich an, um Studio und Admin-Funktionen zu nutzen."
            : " Melde dich an, um freigegebene Kampagneninhalte zu sehen."}
        </p>

        <ul className="uwe-auth-feature-list">
          {features.map((feature) => (
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
  );
}
