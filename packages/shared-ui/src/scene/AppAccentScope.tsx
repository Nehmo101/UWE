import type { ReactNode } from "react";

/**
 * Trägt den Produktakzent einer App für ihren Teilbaum.
 *
 * Der Handoff gibt drei Akzente (Landing/Studio terracotta, Portal teal, Brain
 * violett) bei nur zwei Themes — er gehört deshalb nicht ins Theme. Ein
 * Selektor auf `html[data-uwe-app="…"]` funktioniert nicht: dort schreibt die
 * Theme-Engine `--uwe-accent` als Inline-Style, und Inline schlägt Stylesheet
 * am selben Element. Auf einem Nachfahren ist der Wert dagegen nur geerbt, und
 * jede Deklaration am Element selbst gewinnt. Genau dieser Nachfahre ist das
 * hier gerenderte Element.
 *
 * Werte und Modus-Auswahl: design-v2/app-accent.css. Kein State, kein Effekt —
 * der Akzent stimmt im ersten server-gerenderten Frame.
 */

export type AccentApp = "studio" | "portal" | "brain";

/** Steuert, ob der Träger im Layout verschwindet oder selbst Layout trägt. */
export type AccentScopeLayout = "contents" | "block" | "flex-column";

export function AppAccentScope({
  app,
  layout = "contents",
  className,
  children,
}: {
  app: AccentApp;
  layout?: AccentScopeLayout;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={className ? `uwe-accent-scope ${className}` : "uwe-accent-scope"}
      data-accent-app={app}
      data-layout={layout === "contents" ? undefined : layout}
    >
      {children}
    </div>
  );
}
