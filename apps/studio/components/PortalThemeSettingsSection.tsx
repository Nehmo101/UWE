"use client";

import {
  ThemeScopeSettingsPanel,
  fromUweThemePreferences,
  toUweThemePreferences,
} from "@uwe/shared-ui";
import type { ThemePreferencesRecord } from "@uwe/database/theme-preferences";
import { saveThemePreferencesAction } from "../app/theme-actions";

export function PortalThemeSettingsSection({
  initialPreferences,
}: {
  initialPreferences: ThemePreferencesRecord;
}) {
  return (
    <ThemeScopeSettingsPanel
      title="Portal-Standard"
      description="Standard-Erscheinungsbild für das UWE Portal. Wird beim ersten Besuch auf neuen Geräten übernommen und mit localStorage synchronisiert."
      preferences={toUweThemePreferences(initialPreferences, "portal")}
      onPersist={async (preferences) =>
        saveThemePreferencesAction("portal", fromUweThemePreferences(preferences))
      }
    />
  );
}
