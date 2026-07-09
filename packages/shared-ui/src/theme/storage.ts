import {
  DEFAULT_BACKGROUND,
  DEFAULT_DENSITY,
  DEFAULT_FONT,
  DEFAULT_UI_SCALE,
  normalizeElementOverrides,
  type AppScope,
  type BackgroundPatternId,
  type DensityId,
  type ElementOverrideTokens,
  type FontFamilyId,
} from "./tokens";
import {
  DEFAULT_PORTAL_THEME_ID,
  DEFAULT_STUDIO_THEME_ID,
  resolveThemeId,
} from "./themes";

export interface UweThemePreferences {
  /** Built-in `ThemeId` or a registered custom theme id (`custom-…`). */
  themeId: string;
  font: FontFamilyId;
  density: DensityId;
  background: BackgroundPatternId;
  frostedGlass: boolean;
  uiScale: number;
  bgEffectColor?: string;
  bgEffectIntensity: number;
  elementOverrides?: ElementOverrideTokens;
}

const STORAGE_KEY: Record<AppScope, string> = {
  studio: "uwe-theme-preferences-studio",
  portal: "uwe-theme-preferences-portal",
};

export function defaultPreferences(scope: AppScope): UweThemePreferences {
  return {
    themeId: scope === "portal" ? DEFAULT_PORTAL_THEME_ID : DEFAULT_STUDIO_THEME_ID,
    font: DEFAULT_FONT,
    density: DEFAULT_DENSITY,
    background: scope === "studio" ? "constellation" : DEFAULT_BACKGROUND,
    frostedGlass: true,
    uiScale: DEFAULT_UI_SCALE,
    bgEffectColor: scope === "studio" ? "#fecaca" : undefined,
    bgEffectIntensity: scope === "studio" ? 0.38 : 1,
  };
}

export function getStorageKey(scope: AppScope): string {
  return STORAGE_KEY[scope];
}

function parsePreferences(
  raw: unknown,
  scope: AppScope,
): UweThemePreferences | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const defaults = defaultPreferences(scope);
  const themeId =
    typeof obj.themeId === "string"
      ? resolveThemeId(obj.themeId, defaults.themeId)
      : defaults.themeId;
  const font =
    obj.font === "mono" || obj.font === "sans" || obj.font === "serif"
      ? obj.font
      : defaults.font;
  const density =
    obj.density === "compact" ||
    obj.density === "comfortable" ||
    obj.density === "spacious"
      ? obj.density
      : defaults.density;
  const background =
    obj.background === "none" ||
    obj.background === "dots" ||
    obj.background === "synapse" ||
    obj.background === "constellation" ||
    obj.background === "parchment" ||
    obj.background === "noise"
      ? obj.background
      : defaults.background;
  const frostedGlass =
    typeof obj.frostedGlass === "boolean" ? obj.frostedGlass : defaults.frostedGlass;
  const uiScale =
    typeof obj.uiScale === "number" && obj.uiScale >= 0.9 && obj.uiScale <= 1.1
      ? obj.uiScale
      : defaults.uiScale;
  const bgEffectIntensity =
    typeof obj.bgEffectIntensity === "number" &&
    obj.bgEffectIntensity >= 0 &&
    obj.bgEffectIntensity <= 1
      ? obj.bgEffectIntensity
      : defaults.bgEffectIntensity;
  const bgEffectColor =
    typeof obj.bgEffectColor === "string" ? obj.bgEffectColor : undefined;
  const elementOverrides = normalizeElementOverrides(obj.elementOverrides);

  return {
    themeId,
    font,
    density,
    background,
    frostedGlass,
    uiScale,
    bgEffectColor,
    bgEffectIntensity,
    elementOverrides,
  };
}

export function loadPreferences(scope: AppScope): UweThemePreferences {
  if (typeof window === "undefined") {
    return defaultPreferences(scope);
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(scope));
    if (!raw) return defaultPreferences(scope);
    const parsed = parsePreferences(JSON.parse(raw) as unknown, scope);
    return parsed ?? defaultPreferences(scope);
  } catch {
    return defaultPreferences(scope);
  }
}

export function savePreferences(
  scope: AppScope,
  preferences: UweThemePreferences,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getStorageKey(scope),
      JSON.stringify(preferences),
    );
  } catch {
    // Quota or privacy mode — ignore.
  }
}

