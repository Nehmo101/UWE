export type ThemeAppearance = "dark" | "light" | "system";

export type BackgroundPattern =
  | "none"
  | "dots"
  | "constellation"
  | "synapse"
  | "parchment"
  | "subtle-noise";

export interface VisualThemeSettings {
  theme: ThemeAppearance;
  backgroundPattern: BackgroundPattern;
  frostedGlass: boolean;
  motionEnabled: boolean;
}

export type VisualThemeAppVariant = "studio" | "portal" | "brain";

export interface VisualThemeHtmlAttributes {
  /** dark / light / system — drives color-scheme and a11y CSS hooks */
  "data-theme": ThemeAppearance;
  /**
   * Same appearance value as `data-theme`, kept as its own hook for the polish
   * layer. Deliberately NOT `data-uwe-theme`: that attribute carries the theme
   * *id* (`uwe-ghibli-tag`, …) written by the theme engine and its bootstrap
   * script. Sharing one attribute for both vocabularies meant the SSR markup
   * shipped `data-uwe-theme="dark"` until hydration, so every theme-scoped CSS
   * rule missed the first paint.
   */
  "data-uwe-appearance": ThemeAppearance;
  "data-uwe-bg-pattern": BackgroundPattern;
  "data-uwe-glass": "on" | "off";
  "data-uwe-motion": "on" | "off";
  "data-uwe-app"?: VisualThemeAppVariant;
}

/** Map persisted app settings to root-level HTML data attributes for CSS hooks. */
export function buildVisualThemeHtmlAttributes(
  app: VisualThemeSettings,
  options?: { appVariant?: VisualThemeAppVariant },
): VisualThemeHtmlAttributes {
  return {
    "data-theme": app.theme,
    "data-uwe-appearance": app.theme,
    "data-uwe-bg-pattern": app.backgroundPattern ?? "none",
    "data-uwe-glass": app.frostedGlass !== false ? "on" : "off",
    "data-uwe-motion": app.motionEnabled !== false ? "on" : "off",
    ...(options?.appVariant ? { "data-uwe-app": options.appVariant } : {}),
  };
}

export const BACKGROUND_PATTERN_LABELS: Record<BackgroundPattern, string> = {
  none: "Keins",
  dots: "Punkte",
  constellation: "Sternbild",
  synapse: "Synapse",
  parchment: "Pergament",
  "subtle-noise": "Feines Rauschen",
};

export function applyThemeAppearance(theme: ThemeAppearance): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}
