"use client";

import { ThemeProvider, type UweThemePreferences } from "@uwe/shared-ui";
import type { ReactNode } from "react";

export function PortalThemeSyncProvider({
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
      scope="portal"
      serverPreferences={serverPreferences}
      serverUpdatedAt={serverUpdatedAt}
    >
      {children}
    </ThemeProvider>
  );
}
