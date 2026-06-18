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

export type VisualThemeAppVariant = "studio" | "portal";

export interface VisualThemeHtmlAttributes {
  "data-uwe-theme": ThemeAppearance;
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
    "data-uwe-theme": app.theme,
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
