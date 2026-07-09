import type { BackgroundPattern, ThemeAppearance, UweSystemSettingsUpdate } from "./settings-service";
import { BACKGROUND_PATTERN_VALUES, STUDIO_LANDING_PAGE_PATHS } from "./settings-service";
import { isRecord, parseHiddenNavIdsUpdate, requireBoolean, requireEnum, validateSection } from "./settings-validation-helpers";

const THEME_VALUES = new Set<ThemeAppearance>(["dark", "light", "system"]);
const BACKGROUND_PATTERN_SET = new Set<BackgroundPattern>(BACKGROUND_PATTERN_VALUES);
const STUDIO_LANDING_PAGE_PATH_SET = new Set<string>(STUDIO_LANDING_PAGE_PATHS);

const APP_KEYS = new Set([
  "theme",
  "backgroundPattern",
  "frostedGlass",
  "motionEnabled",
  "defaultLandingPage",
  "favoriteWorldSlug",
  "lastActiveWorldSlug",
  "hiddenNavIds",
]);

export function validateAppSettingsSection(
  appBody: unknown,
): { errors: string[]; app?: NonNullable<UweSystemSettingsUpdate["app"]> } {
  const errors: string[] = [];
  const sectionErrors = validateSection(appBody, APP_KEYS, "settings.app", (key, value, sectionErrors) => {
    if (key === "theme") {
      requireEnum(value, THEME_VALUES, "settings.app.theme", sectionErrors);
    }
    if (key === "backgroundPattern") {
      requireEnum(value, BACKGROUND_PATTERN_SET, "settings.app.backgroundPattern", sectionErrors);
    }
    if (key === "frostedGlass" || key === "motionEnabled") {
      requireBoolean(value, `settings.app.${key}`, sectionErrors);
    }
  });
  errors.push(...sectionErrors);

  if (!isRecord(appBody)) {
    return { errors };
  }

  const appErrors: string[] = [];
  const app: NonNullable<UweSystemSettingsUpdate["app"]> = {};
  if (appBody.theme !== undefined) {
    if (requireEnum(appBody.theme, THEME_VALUES, "settings.app.theme", appErrors)) {
      app.theme = appBody.theme as ThemeAppearance;
    }
  }
  if (appBody.backgroundPattern !== undefined) {
    if (
      requireEnum(
        appBody.backgroundPattern,
        BACKGROUND_PATTERN_SET,
        "settings.app.backgroundPattern",
        appErrors,
      )
    ) {
      app.backgroundPattern = appBody.backgroundPattern as BackgroundPattern;
    }
  }
  if (appBody.frostedGlass !== undefined) {
    if (requireBoolean(appBody.frostedGlass, "settings.app.frostedGlass", appErrors)) {
      app.frostedGlass = appBody.frostedGlass;
    }
  }
  if (appBody.motionEnabled !== undefined) {
    if (requireBoolean(appBody.motionEnabled, "settings.app.motionEnabled", appErrors)) {
      app.motionEnabled = appBody.motionEnabled;
    }
  }
  if (appBody.defaultLandingPage !== undefined) {
    if (appBody.defaultLandingPage !== null && typeof appBody.defaultLandingPage !== "string") {
      appErrors.push("settings.app.defaultLandingPage muss ein String oder null sein.");
    } else {
      const trimmed =
        typeof appBody.defaultLandingPage === "string" ? appBody.defaultLandingPage.trim() : "";
      if (trimmed && !STUDIO_LANDING_PAGE_PATH_SET.has(trimmed)) {
        appErrors.push(
          "settings.app.defaultLandingPage muss /today, /worlds, /continue oder /capture sein.",
        );
      } else {
        app.defaultLandingPage = trimmed || "/today";
      }
    }
  }
  if (appBody.favoriteWorldSlug !== undefined) {
    if (appBody.favoriteWorldSlug !== null && typeof appBody.favoriteWorldSlug !== "string") {
      appErrors.push("settings.app.favoriteWorldSlug muss ein String oder null sein.");
    } else {
      app.favoriteWorldSlug =
        typeof appBody.favoriteWorldSlug === "string"
          ? appBody.favoriteWorldSlug.trim() || null
          : null;
    }
  }
  if (appBody.lastActiveWorldSlug !== undefined) {
    if (appBody.lastActiveWorldSlug !== null && typeof appBody.lastActiveWorldSlug !== "string") {
      appErrors.push("settings.app.lastActiveWorldSlug muss ein String oder null sein.");
    } else {
      app.lastActiveWorldSlug =
        typeof appBody.lastActiveWorldSlug === "string"
          ? appBody.lastActiveWorldSlug.trim() || null
          : null;
    }
  }
  if (appBody.hiddenNavIds !== undefined) {
    const hiddenNavIds = parseHiddenNavIdsUpdate(appBody.hiddenNavIds, appErrors);
    if (hiddenNavIds !== undefined) {
      app.hiddenNavIds = hiddenNavIds;
    }
  }

  errors.push(...appErrors);
  if (appErrors.length === 0 && sectionErrors.length === 0 && Object.keys(app).length > 0) {
    return { errors, app };
  }
  return { errors };
}
