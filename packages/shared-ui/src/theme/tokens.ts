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
  sidebarBg: "--uwe-sidebar-bg",
  sidebarFg: "--uwe-sidebar-fg",
  sidebarFgMuted: "--uwe-sidebar-fg-muted",
  cardBg: "--uwe-card-bg",
  inputBg: "--uwe-input-bg",
  focusRing: "--uwe-focus-ring",
  focusShadow: "--uwe-focus-shadow",
  spacingXs: "--uwe-spacing-xs",
  spacingSm: "--uwe-spacing-sm",
  spacingMd: "--uwe-spacing-md",
  spacingLg: "--uwe-spacing-lg",
  spacingXl: "--uwe-spacing-xl",
  spacing2xl: "--uwe-spacing-2xl",
  radiusSm: "--uwe-radius-sm",
  radiusMd: "--uwe-radius-md",
  radiusLg: "--uwe-radius-lg",
  shadowSm: "--uwe-shadow-sm",
  shadowMd: "--uwe-shadow-md",
  shadowLg: "--uwe-shadow-lg",
  fontFamily: "--uwe-font-family",
  densityScale: "--uwe-density-scale",
  uiScale: "--uwe-ui-scale",
  bgEffectColor: "--uwe-bg-effect-color",
  bgEffectIntensity: "--uwe-bg-effect-intensity",
  zoneChromeBg: "--uwe-zone-chrome-bg",
  zoneChromeFg: "--uwe-zone-chrome-fg",
  zoneHeadingFg: "--uwe-zone-heading-fg",
  zoneHeadingFont: "--uwe-zone-heading-font",
  zoneCardBg: "--uwe-zone-card-bg",
  zoneCardBorder: "--uwe-zone-card-border",
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
  /** Optional — derived from panel when omitted */
  sidebarBg?: string;
  /** Optional — light text for dark sidebars; defaults to fg when omitted */
  sidebarFg?: string;
  /** Optional — muted text inside dark sidebars; defaults to fgMuted when omitted */
  sidebarFgMuted?: string;
  /** Optional — derived from surface when omitted */
  cardBg?: string;
  /** Optional — derived from bgElevated when omitted */
  inputBg?: string;
  /** Optional — derived from accent when omitted */
  focusRing?: string;
  focusShadow?: string;
};

/** Per-zone color/font overrides persisted in theme preferences. */
export type ElementOverrideTokens = Partial<{
  chromeBg: string;
  chromeFg: string;
  headingFg: string;
  /** CSS font-family value or FontFamilyId (`mono` | `sans` | `serif`). */
  headingFont: string;
  cardBg: string;
  cardBorder: string;
}>;

export const ELEMENT_OVERRIDE_KEYS = [
  "chromeBg",
  "chromeFg",
  "headingFg",
  "headingFont",
  "cardBg",
  "cardBorder",
] as const satisfies readonly (keyof ElementOverrideTokens)[];

export const ELEMENT_OVERRIDE_CSS_VARS: Record<
  (typeof ELEMENT_OVERRIDE_KEYS)[number],
  string
> = {
  chromeBg: CSS_VARS.zoneChromeBg,
  chromeFg: CSS_VARS.zoneChromeFg,
  headingFg: CSS_VARS.zoneHeadingFg,
  headingFont: CSS_VARS.zoneHeadingFont,
  cardBg: CSS_VARS.zoneCardBg,
  cardBorder: CSS_VARS.zoneCardBorder,
};

const FONT_FAMILY_IDS = new Set<FontFamilyId>(["mono", "sans", "serif"]);

export function normalizeElementOverrides(raw: unknown): ElementOverrideTokens | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const result: ElementOverrideTokens = {};

  for (const key of ELEMENT_OVERRIDE_KEYS) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      result[key] = value.trim();
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function resolveElementOverrideValue(
  key: (typeof ELEMENT_OVERRIDE_KEYS)[number],
  value: string,
): string {
  if (key === "headingFont" && FONT_FAMILY_IDS.has(value as FontFamilyId)) {
    return FONT_FAMILIES[value as FontFamilyId];
  }
  return value;
}

/** Static layout tokens (not per-preset). */
export const LAYOUT_TOKENS = {
  spacingXs: "0.25rem",
  spacingSm: "0.5rem",
  spacingMd: "0.75rem",
  spacingLg: "1rem",
  spacingXl: "1.5rem",
  spacing2xl: "2rem",
  radiusSm: "0.375rem",
  radiusMd: "0.5rem",
  radiusLg: "0.75rem",
  shadowSm: "0 1px 2px rgba(0, 0, 0, 0.22)",
  shadowMd: "0 4px 14px rgba(0, 0, 0, 0.28)",
  shadowLg: "0 16px 40px rgba(0, 0, 0, 0.38)",
} as const;

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
  mono: "var(--uwe-font-space-mono, ui-monospace), 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace",
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  serif: "var(--uwe-font-newsreader, Georgia), 'Iowan Old Style', 'Palatino Linotype', 'Times New Roman', serif",
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
