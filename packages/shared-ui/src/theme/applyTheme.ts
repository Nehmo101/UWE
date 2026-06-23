import {
  CSS_VARS,
  DENSITY_SCALES,
  FONT_FAMILIES,
  LAYOUT_TOKENS,
  type AppScope,
  type BackgroundPatternId,
  type DensityId,
  type FontFamilyId,
  type ThemeColorTokens,
} from "./tokens";
import { resolveThemeColorTokens } from "./resolveColorTokens";
import type { UweThemePreferences } from "./storage";
import { getTheme, type ThemeId } from "./themes";

const BG_PATTERN_CLASSES = [
  "uwe-bg-none",
  "uwe-bg-dots",
  "uwe-bg-synapse",
  "uwe-bg-constellation",
  "uwe-bg-parchment",
  "uwe-bg-noise",
] as const;

const DENSITY_CLASSES = [
  "uwe-density-compact",
  "uwe-density-comfortable",
  "uwe-density-spacious",
] as const;

export function applyLayoutTokens(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const style = root.style;
  style.setProperty(CSS_VARS.spacingXs, LAYOUT_TOKENS.spacingXs);
  style.setProperty(CSS_VARS.spacingSm, LAYOUT_TOKENS.spacingSm);
  style.setProperty(CSS_VARS.spacingMd, LAYOUT_TOKENS.spacingMd);
  style.setProperty(CSS_VARS.spacingLg, LAYOUT_TOKENS.spacingLg);
  style.setProperty(CSS_VARS.spacingXl, LAYOUT_TOKENS.spacingXl);
  style.setProperty(CSS_VARS.spacing2xl, LAYOUT_TOKENS.spacing2xl);
  style.setProperty(CSS_VARS.radiusSm, LAYOUT_TOKENS.radiusSm);
  style.setProperty(CSS_VARS.radiusMd, LAYOUT_TOKENS.radiusMd);
  style.setProperty(CSS_VARS.radiusLg, LAYOUT_TOKENS.radiusLg);
  style.setProperty(CSS_VARS.shadowSm, LAYOUT_TOKENS.shadowSm);
  style.setProperty(CSS_VARS.shadowMd, LAYOUT_TOKENS.shadowMd);
  style.setProperty(CSS_VARS.shadowLg, LAYOUT_TOKENS.shadowLg);
}

export function applyColorTokens(colors: ThemeColorTokens): void {
  if (typeof document === "undefined") return;
  const resolved = resolveThemeColorTokens(colors);
  const root = document.documentElement;
  const style = root.style;
  style.setProperty(CSS_VARS.bg, resolved.bg);
  style.setProperty(CSS_VARS.bgElevated, resolved.bgElevated);
  style.setProperty(CSS_VARS.surface, resolved.surface);
  style.setProperty(CSS_VARS.panel, resolved.panel);
  style.setProperty(CSS_VARS.border, resolved.border);
  style.setProperty(CSS_VARS.borderMuted, resolved.borderMuted);
  style.setProperty(CSS_VARS.fg, resolved.fg);
  style.setProperty(CSS_VARS.fgMuted, resolved.fgMuted);
  style.setProperty(CSS_VARS.fgSubtle, resolved.fgSubtle);
  style.setProperty(CSS_VARS.accent, resolved.accent);
  style.setProperty(CSS_VARS.accentHover, resolved.accentHover);
  style.setProperty(CSS_VARS.accentMuted, resolved.accentMuted);
  style.setProperty(CSS_VARS.danger, resolved.danger);
  style.setProperty(CSS_VARS.warning, resolved.warning);
  style.setProperty(CSS_VARS.success, resolved.success);
  style.setProperty(CSS_VARS.info, resolved.info);
  style.setProperty(CSS_VARS.wikiLink, resolved.wikiLink);
  style.setProperty(CSS_VARS.wikiLinkHover, resolved.wikiLinkHover);
  style.setProperty(CSS_VARS.dmOnly, resolved.dmOnly);
  style.setProperty(CSS_VARS.playerVisible, resolved.playerVisible);
  style.setProperty(CSS_VARS.shellGradientStart, resolved.shellGradientStart);
  style.setProperty(CSS_VARS.shellGradientMid, resolved.shellGradientMid);
  style.setProperty(CSS_VARS.shellGradientEnd, resolved.shellGradientEnd);
  style.setProperty(CSS_VARS.sidebarBg, resolved.sidebarBg);
  style.setProperty(CSS_VARS.sidebarFg, resolved.sidebarFg);
  style.setProperty(CSS_VARS.sidebarFgMuted, resolved.sidebarFgMuted);
  style.setProperty(CSS_VARS.cardBg, resolved.cardBg);
  style.setProperty(CSS_VARS.inputBg, resolved.inputBg);
  style.setProperty(CSS_VARS.focusRing, resolved.focusRing);
  style.setProperty(CSS_VARS.focusShadow, resolved.focusShadow);
  applyLayoutTokens();

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved.bg);
}

export function applyFont(font: FontFamilyId): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    CSS_VARS.fontFamily,
    FONT_FAMILIES[font],
  );
  document.documentElement.dataset.uweFont = font;
}

export function applyDensity(density: DensityId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty(CSS_VARS.densityScale, String(DENSITY_SCALES[density]));
  for (const cls of DENSITY_CLASSES) root.classList.remove(cls);
  root.classList.add(`uwe-density-${density}`);
  root.dataset.uweDensity = density;
}

export function applyUiScale(scale: number): void {
  if (typeof document === "undefined") return;
  const clamped = Math.max(0.9, Math.min(1.1, scale));
  document.documentElement.style.setProperty(CSS_VARS.uiScale, String(clamped));
  document.documentElement.dataset.uweUiScale = String(clamped);
}

export function applyBackgroundPattern(pattern: BackgroundPatternId): void {
  if (typeof document === "undefined") return;
  const body = document.body;
  for (const cls of BG_PATTERN_CLASSES) body.classList.remove(cls);
  if (pattern !== "none") {
    body.classList.add(`uwe-bg-${pattern}`);
  }
  body.dataset.uweBackground = pattern;
}

export function applyFrostedGlass(enabled: boolean): void {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("uwe-theme-frosted", enabled);
  document.body.dataset.uweFrosted = enabled ? "true" : "false";
}

export function applyBgEffectOptions(
  color: string | undefined,
  intensity: number,
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (color) {
    root.style.setProperty(CSS_VARS.bgEffectColor, color);
  } else {
    root.style.removeProperty(CSS_VARS.bgEffectColor);
  }
  root.style.setProperty(
    CSS_VARS.bgEffectIntensity,
    String(Math.max(0, Math.min(1, intensity))),
  );
}

export function applyThemePreferences(
  preferences: UweThemePreferences,
  _scope?: AppScope,
): void {
  const theme = getTheme(preferences.themeId);
  applyColorTokens(theme.colors);
  applyFont(preferences.font);
  applyDensity(preferences.density);
  applyUiScale(preferences.uiScale);
  applyBackgroundPattern(preferences.background);
  applyFrostedGlass(preferences.frostedGlass);
  const effectColor =
    preferences.bgEffectColor ??
    theme.defaults?.bgEffectColor ??
    theme.colors.accent;
  const effectIntensity =
    preferences.bgEffectIntensity ??
    theme.defaults?.bgEffectIntensity ??
    1;
  applyBgEffectOptions(effectColor, effectIntensity);

  if (typeof document !== "undefined") {
    document.documentElement.dataset.uweTheme = preferences.themeId;
  }
}

export function mergeWithThemeDefaults(
  preferences: UweThemePreferences,
): UweThemePreferences {
  const theme = getTheme(preferences.themeId);
  const defaults = theme.defaults;
  return {
    ...preferences,
    font: preferences.font || defaults?.font || preferences.font,
    density: preferences.density || defaults?.density || preferences.density,
    background:
      preferences.background === "none" && defaults?.background
        ? defaults.background
        : preferences.background,
    frostedGlass:
      preferences.frostedGlass ?? defaults?.frostedGlass ?? true,
    bgEffectColor: preferences.bgEffectColor ?? defaults?.bgEffectColor,
    bgEffectIntensity:
      preferences.bgEffectIntensity ??
      defaults?.bgEffectIntensity ??
      1,
  };
}

export function applyThemeById(themeId: ThemeId): void {
  applyColorTokens(getTheme(themeId).colors);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.uweTheme = themeId;
  }
}
