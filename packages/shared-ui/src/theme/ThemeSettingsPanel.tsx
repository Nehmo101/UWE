"use client";

import { useUweTheme } from "./ThemeProvider";
import { ThemePreferencesFields } from "./ThemeScopeSettingsPanel";

export function ThemeSettingsPanel() {
  const { preferences, updatePreferences, resetPreferences, syncState, scope } =
    useUweTheme();

  return (
    <section className="max-w-3xl" aria-labelledby="uwe-theme-settings-title">
      <h2 id="uwe-theme-settings-title">Studio-Design</h2>
      <p className="text-sm text-muted-foreground">
        Theme-Einstellungen werden in diesem Browser gespeichert und mit den
        Server-Standards synchronisiert (geräteübergreifend). Änderungen gelten
        sofort.
      </p>
      {syncState === "syncing" && (
        <p className="text-sm text-muted-foreground" role="status">
          Synchronisiere mit Server…
        </p>
      )}
      {syncState === "synced" && (
        <p className="text-sm text-muted-foreground" role="status">
          Mit Server synchronisiert.
        </p>
      )}
      {syncState === "error" && (
        <p
          className="rounded-[0.5rem] border border-[color-mix(in_srgb,var(--uwe-success)_25%,transparent)] bg-[color-mix(in_srgb,var(--uwe-success)_12%,transparent)] px-4 py-3 text-[color-mix(in_srgb,var(--uwe-success)_70%,white_30%)]"
          role="status"
        >
          Server-Sync fehlgeschlagen — lokale Einstellungen bleiben aktiv.
        </p>
      )}
      <ThemePreferencesFields
        preferences={preferences}
        updatePreferences={updatePreferences}
        onReset={() => resetPreferences()}
        scope={scope}
      />
    </section>
  );
}
