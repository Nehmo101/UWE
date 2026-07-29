import type { LocalHostServiceId } from "../../lib/tauri";
import { Button } from "../ui/button";

import {
  INSTALL_APPS,
  INSTALL_PRESETS,
  databasesFor,
  presetIdFor,
} from "./install-catalog";

interface Props {
  apps: LocalHostServiceId[];
  seedDemoContent: boolean;
  busy: boolean;
  onChangeApps: (apps: LocalHostServiceId[]) => void;
  onChangeSeed: (value: boolean) => void;
}

/**
 * Schritt „Was soll installiert werden?" — Vorlagen als Abkürzung, Häkchen als
 * Feinsteuerung. Die Datenbank-Zeile darunter macht sichtbar, was die Auswahl
 * tatsächlich anlegt; das ist der Teil, den man sonst erst nach dem Bauen merkt.
 */
export function InstallAppPicker({
  apps,
  seedDemoContent,
  busy,
  onChangeApps,
  onChangeSeed,
}: Props) {
  const activePreset = presetIdFor(apps);

  function toggle(id: LocalHostServiceId, enabled: boolean) {
    // Reihenfolge folgt dem Katalog, nicht der Klick-Reihenfolge.
    const next = INSTALL_APPS.filter((entry) =>
      entry.id === id ? enabled : apps.includes(entry.id),
    ).map((entry) => entry.id);
    onChangeApps(next);
  }

  return (
    <div className="connector-stack">
      <div className="connector-actions">
        {INSTALL_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant={activePreset === preset.id ? "secondary" : "ghost"}
            onClick={() => onChangeApps([...preset.apps])}
            disabled={busy}
            title={preset.description}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="install-app-grid">
        {INSTALL_APPS.map((entry) => {
          const checked = apps.includes(entry.id);
          return (
            <label
              key={entry.id}
              className={`install-app-option${checked ? " is-selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={busy}
                onChange={(event) => toggle(entry.id, event.target.checked)}
              />
              <span className="install-app-body">
                <span className="install-app-title">
                  <strong>{entry.label}</strong>
                  <small>Port {entry.defaultPort}</small>
                </span>
                <span className="install-app-tagline">{entry.tagline}</span>
                <span className="connector-muted">{entry.description}</span>
              </span>
            </label>
          );
        })}
      </div>

      {apps.length === 0 ? (
        <div className="connector-banner connector-banner-error">
          Mindestens ein Bereich muss ausgewählt sein.
        </div>
      ) : null}

      <div className="connector-stats-row">
        {databasesFor(apps).map((database) => (
          <div key={database} className="connector-stat-pill">
            {database}
          </div>
        ))}
      </div>
      <p className="connector-muted">
        Diese Datenbanken werden angelegt und migriert. <code>uwe.db</code> trägt Konten und
        Einstellungen und gehört deshalb immer dazu.
      </p>

      <label className="connector-checkbox">
        <input
          type="checkbox"
          checked={seedDemoContent}
          disabled={busy}
          onChange={(event) => onChangeSeed(event.target.checked)}
        />
        <span>Demo-Grundbestand einspielen (Beispielwelt zum Ausprobieren)</span>
      </label>
      <p className="connector-muted">
        Wirkt nur beim ersten Aufbau einer leeren Datenbank. Bestehende Daten werden nie
        überschrieben.
      </p>
    </div>
  );
}
