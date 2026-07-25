import type { ThemePreferencesRecord, ThemePreferencesScope } from "@uwe/database/server";
import { resolveThemeId } from "./themes";
import {
  defaultPreferences,
  getStorageKey,
  type UweThemePreferences,
} from "./storage";
import type { AppScope, BackgroundPatternId } from "./tokens";

const SYNC_TIMESTAMP_KEY: Record<AppScope, string> = {
  studio: "uwe-theme-sync-at-studio",
  portal: "uwe-theme-sync-at-portal",
  brain: "uwe-theme-sync-at-brain",
};

export function getSyncTimestampKey(scope: AppScope): string {
  return SYNC_TIMESTAMP_KEY[scope];
}

function getBrowserStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      return globalThis.localStorage as Storage;
    }
  } catch {
    // ignore
  }
  return null;
}

export function getSyncTimestamp(scope: AppScope): string | null {
  const storage = getBrowserStorage();
  if (!storage) return null;
  try {
    return storage.getItem(getSyncTimestampKey(scope));
  } catch {
    return null;
  }
}

export function setSyncTimestamp(scope: AppScope, isoTimestamp: string): void {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(getSyncTimestampKey(scope), isoTimestamp);
  } catch {
    // ignore
  }
}

export function hasStoredPreferences(scope: AppScope): boolean {
  const storage = getBrowserStorage();
  if (!storage) return false;
  try {
    return storage.getItem(getStorageKey(scope)) !== null;
  } catch {
    return false;
  }
}

export function shouldApplyServerPreferences(
  scope: AppScope,
  serverUpdatedAt: string | null | undefined,
): boolean {
  if (!serverUpdatedAt) {
    return !hasStoredPreferences(scope);
  }
  const localSyncedAt = getSyncTimestamp(scope);
  if (!hasStoredPreferences(scope)) return true;
  if (!localSyncedAt) return true;
  return serverUpdatedAt > localSyncedAt;
}

export function toUweThemePreferences(
  record: ThemePreferencesRecord,
  scope: AppScope,
): UweThemePreferences {
  const defaults = defaultPreferences(scope);
  return {
    themeId: resolveThemeId(record.themeId, defaults.themeId),
    font: record.font,
    density: record.density,
    background: record.background as BackgroundPatternId,
    frostedGlass: record.frostedGlass,
    uiScale: record.uiScale,
    bgEffectColor: record.bgEffectColor,
    bgEffectIntensity: record.bgEffectIntensity,
    elementOverrides: record.elementOverrides,
  };
}

export function fromUweThemePreferences(
  preferences: UweThemePreferences,
): ThemePreferencesRecord {
  return {
    themeId: preferences.themeId,
    font: preferences.font,
    density: preferences.density,
    background: preferences.background,
    frostedGlass: preferences.frostedGlass,
    uiScale: preferences.uiScale,
    bgEffectColor: preferences.bgEffectColor,
    bgEffectIntensity: preferences.bgEffectIntensity,
    elementOverrides: preferences.elementOverrides,
  };
}

export function scopeToPreferencesKey(scope: AppScope): ThemePreferencesScope {
  return scope;
}
