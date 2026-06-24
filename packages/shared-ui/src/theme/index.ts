export {
  CSS_VARS,
  DENSITY_SCALES,
  ELEMENT_OVERRIDE_CSS_VARS,
  ELEMENT_OVERRIDE_KEYS,
  FONT_FAMILIES,
  DEFAULT_BACKGROUND,
  DEFAULT_DENSITY,
  DEFAULT_FONT,
  DEFAULT_UI_SCALE,
  normalizeElementOverrides,
  resolveElementOverrideValue,
  type AppScope,
  type BackgroundPatternId,
  type DensityId,
  type ElementOverrideTokens,
  type FontFamilyId,
  type ThemeColorTokens,
} from "./tokens";

export {
  UWE_THEMES,
  THEME_LIST,
  DEFAULT_PORTAL_THEME_ID,
  DEFAULT_STUDIO_THEME_ID,
  getTheme,
  isThemeId,
  resolveThemeId,
  LEGACY_THEME_ID_MAP,
  type ThemeId,
  type UweThemeDefinition,
} from "./themes";

export {
  defaultPreferences,
  getStorageKey,
  loadPreferences,
  savePreferences,
  type UweThemePreferences,
} from "./storage";

export {
  applyBgEffectOptions,
  applyBackgroundPattern,
  applyColorTokens,
  applyDensity,
  applyElementOverrides,
  applyFont,
  applyFrostedGlass,
  applyThemeById,
  applyThemePreferences,
  applyUiScale,
  mergeWithThemeDefaults,
} from "./applyTheme";

export { buildThemeBootstrapScript } from "./bootstrapScript";
export { ThemeBootstrapScript } from "./ThemeBootstrapScript";
export { ThemeProvider, useUweTheme } from "./ThemeProvider";
export { ThemeSettingsPanel } from "./ThemeSettingsPanel";
export { ThemeScopeSettingsPanel, ThemePreferencesFields } from "./ThemeScopeSettingsPanel";
export {
  fromUweThemePreferences,
  getSyncTimestamp,
  setSyncTimestamp,
  shouldApplyServerPreferences,
  toUweThemePreferences,
} from "./sync";
export { BackgroundEffect } from "./BackgroundEffect";
