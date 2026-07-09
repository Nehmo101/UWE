"use client";

import { useUweTheme } from "./ThemeProvider";
import { ThemePreferencesFields } from "./ThemeScopeSettingsPanel";

export function ThemeSettingsPanel() {
  const { preferences, updatePreferences, resetPreferences, syncState, scope } =
    useUweTheme();

  return (
    <section className="uwe-theme-settings" aria-labelledby="uwe-theme-settings-title">
      <h2 id="uwe-theme-settings-title">Studio-Design</h2>
      <p className="uwe-hint">
        Theme-Einstellungen werden in diesem Browser gespeichert und mit den
        Server-Standards synchronisiert (geräteübergreifend). Änderungen gelten
        sofort.
      </p>
      {syncState === "syncing" && (
        <p className="uwe-hint" role="status">
          Synchronisiere mit Server…
        </p>
      )}
      {syncState === "synced" && (
        <p className="uwe-hint" role="status">
          Mit Server synchronisiert.
        </p>
      )}
      {syncState === "error" && (
        <p className="uwe-notice" role="status">
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
