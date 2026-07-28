"use client";

/**
 * Die Produktkarten der Landing.
 *
 * Eigene Datei, damit UweLandingPage.tsx unter dem 700-Zeilen-Budget bleibt
 * (scripts/file-size-budget-check.mjs). Layout und Maße stehen in
 * auth/uwe-landing.css — mobil sind es Zeilen-Buttons, ab 960px Glaskarten.
 */

export type LandingTarget = "studio" | "portal" | "brain" | "family";

interface Choice {
  target: LandingTarget;
  eyebrow: string;
  glyph: string;
  name: string;
  copy: string;
  cta: string;
  /** Hover-/Akzentfarbe der Karte laut Handoff. */
  accent: string;
}

const CHOICES: Choice[] = [
  {
    target: "studio",
    eyebrow: "Für Spielleiter",
    glyph: "☀",
    name: "UWE Studio",
    copy: "Welten bauen, Kampagnen führen, Alltag verwalten — Capture-Inbox & lokale KI inklusive.",
    cta: "Studio öffnen →",
    accent: "#c2622b",
  },
  {
    target: "portal",
    eyebrow: "Für Spieler",
    glyph: "✦",
    name: "UWE Portal",
    copy: "Deine freigegebenen Welten — Wiki, Handouts, Session-Termine. Nur freigegebene Inhalte.",
    cta: "Portal öffnen →",
    accent: "#2f6f63",
  },
  {
    target: "brain",
    eyebrow: "Nur Owner",
    glyph: "☾",
    name: "UWE Brain",
    copy: "Dein privater Alltag und dein Wissen — Mail, Projekte, Werkstatt. Nie in der Cloud.",
    cta: "Brain öffnen →",
    accent: "#6b628c",
  },
  {
    target: "family",
    eyebrow: "Für den Haushalt",
    glyph: "⌂",
    name: "UWE Family",
    copy: "Gemeinsam statt privat — Verträge, Dokumente, Kalender und ein Chat für alle im Haus.",
    cta: "Family öffnen →",
    accent: "#3f6b8c",
  },
];

export function UweLandingChoices({
  onOpen,
  brainVisible,
  familyVisible = true,
}: {
  onOpen: (target: LandingTarget) => void;
  brainVisible: boolean;
  familyVisible?: boolean;
}) {
  const visible = CHOICES.filter(
    (choice) =>
      (choice.target !== "brain" || brainVisible) &&
      (choice.target !== "family" || familyVisible),
  );

  return (
    <div className="uwe-lp-choices">
      {visible.map((choice) => (
        <button
          key={choice.target}
          type="button"
          onClick={() => onOpen(choice.target)}
          className="uwe-lp-card"
          style={{ ["--uwe-lp-accent" as string]: choice.accent }}
        >
          <span className="uwe-lp-card-eyebrow">
            {choice.glyph} {choice.eyebrow}
          </span>
          <span className="uwe-lp-card-name">{choice.name}</span>
          <span className="uwe-lp-card-copy">{choice.copy}</span>
          <span className="uwe-lp-card-cta">{choice.cta}</span>
          <span className="uwe-lp-card-arrow" aria-hidden="true">
            →
          </span>
        </button>
      ))}
    </div>
  );
}
