/** Design token names mapped to CSS custom properties on `:root`. */
export const CSS_VARS = {
  bg: "--uwe-bg",
  bgElevated: "--uwe-bg-elevated",
  surface: "--uwe-surface",
  panel: "--uwe-panel",
  border: "--uwe-border",
  borderMuted: "--uwe-border-muted",
  fg: "--uwe-fg",
  fgMuted: "--uwe-fg-muted",
  fgSubtle: "--uwe-fg-subtle",
  accent: "--uwe-accent",
  accentHover: "--uwe-accent-hover",
  accentMuted: "--uwe-accent-muted",
  danger: "--uwe-danger",
  warning: "--uwe-warning",
  success: "--uwe-success",
  info: "--uwe-info",
  wikiLink: "--uwe-wiki-link",
  wikiLinkHover: "--uwe-wiki-link-hover",
  dmOnly: "--uwe-dm-only",
  playerVisible: "--uwe-player-visible",
  shellGradientStart: "--uwe-shell-gradient-start",
  shellGradientMid: "--uwe-shell-gradient-mid",
  shellGradientEnd: "--uwe-shell-gradient-end",
  fontFamily: "--uwe-font-family",
  densityScale: "--uwe-density-scale",
  uiScale: "--uwe-ui-scale",
  bgEffectColor: "--uwe-bg-effect-color",
  bgEffectIntensity: "--uwe-bg-effect-intensity",
} as const;

export type ThemeColorTokens = {
  bg: string;
  bgElevated: string;
  surface: string;
  panel: string;
  border: string;
  borderMuted: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  accent: string;
  accentHover: string;
  accentMuted: string;
  danger: string;
  warning: string;
  success: string;
  info: string;
  wikiLink: string;
  wikiLinkHover: string;
  dmOnly: string;
  playerVisible: string;
  shellGradientStart: string;
  shellGradientMid: string;
  shellGradientEnd: string;
};

export type FontFamilyId = "mono" | "sans" | "serif";

export type DensityId = "compact" | "comfortable" | "spacious";

export type BackgroundPatternId =
  | "none"
  | "dots"
  | "synapse"
  | "constellation"
  | "parchment"
  | "noise";

export type AppScope = "studio" | "portal";

export const FONT_FAMILIES: Record<FontFamilyId, string> = {
  mono: "ui-monospace, 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace",
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  serif: "Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Times New Roman', serif",
};

export const DENSITY_SCALES: Record<DensityId, number> = {
  compact: 0.92,
  comfortable: 1,
  spacious: 1.08,
};

export const DEFAULT_FONT: FontFamilyId = "sans";
export const DEFAULT_DENSITY: DensityId = "comfortable";
export const DEFAULT_BACKGROUND: BackgroundPatternId = "none";
export const DEFAULT_UI_SCALE = 1;
