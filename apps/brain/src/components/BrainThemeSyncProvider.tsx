"use client";

import { ThemeProvider, type UweThemePreferences } from "@uwe/shared-ui";
import type { ReactNode } from "react";

/**
 * Theme-Kontext für den Brain-Scope — das Gegenstück zu
 * `StudioThemeSyncProvider` / `PortalThemeSyncProvider`.
 *
 * Ohne ihn wirft jede Chrome-Komponente, die `useUweTheme()` liest (der
 * Hell/Dunkel-Umschalter in der Topbar), beim Rendern — und Next zeigt statt
 * der Seite „Application error: a client-side exception has occurred".
 *
 * Wie im Portal wird hier nicht in die DB zurückgeschrieben: die Persistenz
 * läuft über localStorage plus das Anti-FOUC-Bootstrap; die serverseitigen
 * Vorgaben kommen aus den Systemeinstellungen (Scope „brain").
 */
export function BrainThemeSyncProvider({
  children,
  serverPreferences,
  serverUpdatedAt,
}: {
  children: ReactNode;
  serverPreferences: UweThemePreferences | null;
  serverUpdatedAt: string | null;
}) {
  return (
    <ThemeProvider
      scope="brain"
      serverPreferences={serverPreferences}
      serverUpdatedAt={serverUpdatedAt}
    >
      {children}
    </ThemeProvider>
  );
}
