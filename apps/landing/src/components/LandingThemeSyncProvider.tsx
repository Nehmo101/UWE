"use client";

import {
  ThemeProvider,
  type CustomThemeDefinition,
  type UweThemePreferences,
} from "@uwe/shared-ui";
import type { ReactNode } from "react";

/**
 * Theme-Kontext der öffentlichen Startseite — das Gegenstück zu
 * `StudioThemeSyncProvider` / `BrainThemeSyncProvider`.
 *
 * Ohne ihn wirft der Hell/Dunkel-Umschalter in der Landing-Nav beim Rendern
 * (`useUweTheme()`) und Next zeigt statt der Seite „Application error".
 *
 * Scope „studio", damit die Wahl beim Sprung auf studio.uweanddragons.org
 * erhalten bleibt. Bewusst ohne `onPersist`: die Landing ist anonym erreichbar
 * und darf keine Systemeinstellungen schreiben — die Persistenz läuft über
 * localStorage plus das Anti-FOUC-Bootstrap.
 */
export function LandingThemeSyncProvider({
  children,
  serverPreferences,
  serverUpdatedAt,
  customThemes,
}: {
  children: ReactNode;
  serverPreferences: UweThemePreferences | null;
  serverUpdatedAt: string | null;
  customThemes?: readonly CustomThemeDefinition[];
}) {
  return (
    <ThemeProvider
      scope="studio"
      serverPreferences={serverPreferences}
      serverUpdatedAt={serverUpdatedAt}
      customThemes={customThemes}
    >
      {children}
    </ThemeProvider>
  );
}
