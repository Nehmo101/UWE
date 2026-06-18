"use client";

import { ThemeProvider, type UweThemePreferences } from "@uwe/shared-ui";
import { saveThemePreferencesAction } from "../app/theme-actions";
import { fromUweThemePreferences } from "@uwe/shared-ui";
import type { ReactNode } from "react";

export function StudioThemeSyncProvider({
  children,
  serverPreferences,
  serverUpdatedAt,
}: {
  children: ReactNode;
  serverPreferences: UweThemePreferences;
  serverUpdatedAt: string | null;
}) {
  return (
    <ThemeProvider
      scope="studio"
      serverPreferences={serverPreferences}
      serverUpdatedAt={serverUpdatedAt}
      onPersist={async (preferences) =>
        saveThemePreferencesAction("studio", fromUweThemePreferences(preferences))
      }
    >
      {children}
    </ThemeProvider>
  );
}
