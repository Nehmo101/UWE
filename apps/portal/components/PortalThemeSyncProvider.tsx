"use client";

import {
  ThemeProvider,
  type CustomThemeDefinition,
  type UweThemePreferences,
} from "@uwe/shared-ui";
import type { ReactNode } from "react";

export function PortalThemeSyncProvider({
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
      scope="portal"
      serverPreferences={serverPreferences}
      serverUpdatedAt={serverUpdatedAt}
      customThemes={customThemes}
    >
      {children}
    </ThemeProvider>
  );
}
