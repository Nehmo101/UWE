import type { BackgroundPattern, ThemeAppearance } from "./settings-service";
import { BACKGROUND_PATTERN_VALUES } from "./settings-service";

export type ThemeFontFamily = "mono" | "sans" | "serif";
export type ThemeDensity = "compact" | "comfortable" | "spacious";
export type ThemeClientBackground =
  | "none"
  | "dots"
  | "synapse"
  | "constellation"
  | "parchment"
  | "noise";

export interface ThemePreferencesRecord {
  themeId: string;
  font: ThemeFontFamily;
  density: ThemeDensity;
  background: ThemeClientBackground;
  frostedGlass: boolean;
  uiScale: number;
  bgEffectColor?: string;
  bgEffectIntensity: number;
  elementOverrides?: ThemeElementOverrides;
}

export type ThemeElementOverrides = Partial<{
  chromeBg: string;
  chromeFg: string;
  headingFg: string;
  headingFont: string;
  cardBg: string;
  cardBorder: string;
}>;

export interface AppThemePreferences {
  studio?: ThemePreferencesRecord | null;
  portal?: ThemePreferencesRecord | null;
}

export type ThemePreferencesScope = keyof AppThemePreferences;

const FONT_VALUES = new Set<ThemeFontFamily>(["mono", "sans", "serif"]);
const DENSITY_VALUES = new Set<ThemeDensity>(["compact", "comfortable", "spacious"]);
const CLIENT_BACKGROUND_VALUES = new Set<ThemeClientBackground>([
  "none",
  "dots",
  "synapse",
  "constellation",
  "parchment",
  "noise",
]);

const ELEMENT_OVERRIDE_KEYS = [
  "chromeBg",
  "chromeFg",
  "headingFg",
  "headingFont",
  "cardBg",
  "cardBorder",
] as const satisfies readonly (keyof ThemeElementOverrides)[];

function normalizeElementOverridesRecord(raw: unknown): ThemeElementOverrides | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const result: ThemeElementOverrides = {};

  for (const key of ELEMENT_OVERRIDE_KEYS) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      result[key] = value.trim();
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

const DEFAULT_STUDIO_THEME_ID = "uwe-parchment-os";
const DEFAULT_PORTAL_THEME_ID = "uwe-parchment-os";

export function defaultThemePreferencesRecord(
  scope: ThemePreferencesScope,
): ThemePreferencesRecord {
  return {
    themeId: scope === "portal" ? DEFAULT_PORTAL_THEME_ID : DEFAULT_STUDIO_THEME_ID,
    font: "mono",
    density: "comfortable",
    background: "none",
    frostedGlass: false,
    uiScale: 1,
    bgEffectColor: undefined,
    bgEffectIntensity: 1,
  };
}

export function mapClientBackgroundToServer(
  background: ThemeClientBackground,
): BackgroundPattern {
  if (background === "noise") return "subtle-noise";
  if ((BACKGROUND_PATTERN_VALUES as readonly string[]).includes(background)) {
    return background as BackgroundPattern;
  }
  return "none";
}

export function mapServerBackgroundToClient(
  background: BackgroundPattern,
): ThemeClientBackground {
  if (background === "subtle-noise") return "noise";
  if (CLIENT_BACKGROUND_VALUES.has(background as ThemeClientBackground)) {
    return background as ThemeClientBackground;
  }
  return "none";
}

export function normalizeThemePreferencesRecord(
  raw: unknown,
  scope: ThemePreferencesScope,
): ThemePreferencesRecord | null {
  if (raw == null) return null;
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  const defaults = defaultThemePreferencesRecord(scope);

  const themeId =
    typeof obj.themeId === "string" && obj.themeId.trim() ? obj.themeId.trim() : defaults.themeId;
  const font = FONT_VALUES.has(obj.font as ThemeFontFamily)
    ? (obj.font as ThemeFontFamily)
    : defaults.font;
  const density = DENSITY_VALUES.has(obj.density as ThemeDensity)
    ? (obj.density as ThemeDensity)
    : defaults.density;
  const background = CLIENT_BACKGROUND_VALUES.has(obj.background as ThemeClientBackground)
    ? (obj.background as ThemeClientBackground)
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
    typeof obj.bgEffectColor === "string" && obj.bgEffectColor.trim()
      ? obj.bgEffectColor
      : undefined;
  const elementOverrides = normalizeElementOverridesRecord(obj.elementOverrides);

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

export function normalizeAppThemePreferences(raw: unknown): AppThemePreferences {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const studio =
    obj.studio === null
      ? null
      : normalizeThemePreferencesRecord(obj.studio, "studio") ?? undefined;
  const portal =
    obj.portal === null
      ? null
      : normalizeThemePreferencesRecord(obj.portal, "portal") ?? undefined;
  return { studio, portal };
}

export function getThemePreferencesForScope(
  preferences: AppThemePreferences | undefined,
  scope: ThemePreferencesScope,
): ThemePreferencesRecord | null {
  if (!preferences) return null;
  const value = preferences[scope];
  if (value === null || value === undefined) return null;
  return normalizeThemePreferencesRecord(value, scope);
}

/** Derive stored prefs from legacy app fields when themePreferences is absent. */
export function legacyThemePreferencesFromApp(
  app: {
    theme?: ThemeAppearance;
    backgroundPattern?: BackgroundPattern;
    frostedGlass?: boolean;
  },
  scope: ThemePreferencesScope,
): ThemePreferencesRecord {
  const base = defaultThemePreferencesRecord(scope);
  return {
    ...base,
    background: mapServerBackgroundToClient(app.backgroundPattern ?? "none"),
    frostedGlass: app.frostedGlass !== false,
  };
}

export function resolveThemePreferencesForScope(
  app: {
    theme?: ThemeAppearance;
    backgroundPattern?: BackgroundPattern;
    frostedGlass?: boolean;
    themePreferences?: AppThemePreferences;
  },
  scope: ThemePreferencesScope,
): ThemePreferencesRecord {
  const stored = getThemePreferencesForScope(app.themePreferences, scope);
  if (stored) return stored;
  return legacyThemePreferencesFromApp(app, scope);
}

export function withThemePreferencesForScope(
  current: AppThemePreferences | undefined,
  scope: ThemePreferencesScope,
  preferences: ThemePreferencesRecord,
): AppThemePreferences {
  return {
    ...current,
    [scope]: preferences,
  };
}
