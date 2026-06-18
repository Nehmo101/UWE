import {
  CSS_VARS,
  DENSITY_SCALES,
  FONT_FAMILIES,
  type AppScope,
  type BackgroundPatternId,
  type DensityId,
  type FontFamilyId,
  type ThemeColorTokens,
} from "./tokens";
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

export function applyColorTokens(colors: ThemeColorTokens): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const style = root.style;
  style.setProperty(CSS_VARS.bg, colors.bg);
  style.setProperty(CSS_VARS.bgElevated, colors.bgElevated);
  style.setProperty(CSS_VARS.surface, colors.surface);
  style.setProperty(CSS_VARS.panel, colors.panel);
  style.setProperty(CSS_VARS.border, colors.border);
  style.setProperty(CSS_VARS.borderMuted, colors.borderMuted);
  style.setProperty(CSS_VARS.fg, colors.fg);
  style.setProperty(CSS_VARS.fgMuted, colors.fgMuted);
  style.setProperty(CSS_VARS.fgSubtle, colors.fgSubtle);
  style.setProperty(CSS_VARS.accent, colors.accent);
  style.setProperty(CSS_VARS.accentHover, colors.accentHover);
  style.setProperty(CSS_VARS.accentMuted, colors.accentMuted);
  style.setProperty(CSS_VARS.danger, colors.danger);
  style.setProperty(CSS_VARS.warning, colors.warning);
  style.setProperty(CSS_VARS.success, colors.success);
  style.setProperty(CSS_VARS.info, colors.info);
  style.setProperty(CSS_VARS.wikiLink, colors.wikiLink);
  style.setProperty(CSS_VARS.wikiLinkHover, colors.wikiLinkHover);
  style.setProperty(CSS_VARS.dmOnly, colors.dmOnly);
  style.setProperty(CSS_VARS.playerVisible, colors.playerVisible);
  style.setProperty(CSS_VARS.shellGradientStart, colors.shellGradientStart);
  style.setProperty(CSS_VARS.shellGradientMid, colors.shellGradientMid);
  style.setProperty(CSS_VARS.shellGradientEnd, colors.shellGradientEnd);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", colors.bg);
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
