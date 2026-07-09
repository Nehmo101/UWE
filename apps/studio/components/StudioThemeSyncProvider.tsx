"use client";

import {
  ThemeProvider,
  type CustomThemeDefinition,
  type UweThemePreferences,
} from "@uwe/shared-ui";
import { saveThemePreferencesAction } from "../app/theme-actions";
import { fromUweThemePreferences } from "@uwe/shared-ui";
import type { ReactNode } from "react";

export function StudioThemeSyncProvider({
  children,
  serverPreferences,
  serverUpdatedAt,
  customThemes,
}: {
  children: ReactNode;
  serverPreferences: UweThemePreferences;
  serverUpdatedAt: string | null;
  customThemes?: readonly CustomThemeDefinition[];
}) {
  return (
    <ThemeProvider
      scope="studio"
      serverPreferences={serverPreferences}
      serverUpdatedAt={serverUpdatedAt}
      customThemes={customThemes}
      onPersist={async (preferences) =>
        saveThemePreferencesAction("studio", fromUweThemePreferences(preferences))
      }
    >
      {children}
    </ThemeProvider>
  );
}
