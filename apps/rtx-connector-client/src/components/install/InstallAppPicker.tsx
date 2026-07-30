import type { LocalHostServiceId } from "../../lib/tauri";
import { Button } from "../ui/button";

import {
  INSTALL_APPS,
  INSTALL_PRESETS,
  MAX_SERVICE_PORT,
  MIN_SERVICE_PORT,
  databasesFor,
  isValidPort,
  portConflicts,
  presetIdFor,
  type InstallPortValues,
} from "./install-catalog";

interface Props {
  apps: LocalHostServiceId[];
  ports: InstallPortValues;
  seedDemoContent: boolean;
  busy: boolean;
  onChangeApps: (apps: LocalHostServiceId[]) => void;
  onChangePort: (id: LocalHostServiceId, value: string) => void;
  onChangeSeed: (value: boolean) => void;
}

/**
 * Schritt „Was soll installiert werden?" — Vorlagen als Abkürzung, Häkchen als
 * Feinsteuerung. Die Datenbank-Zeile darunter macht sichtbar, was die Auswahl
 * tatsächlich anlegt; das ist der Teil, den man sonst erst nach dem Bauen merkt.
 *
 * Der Port steht neben jeder App als Eingabefeld, nicht als Beschriftung: auf
 * einem Rechner, auf dem schon etwas auf 3000 lauscht, ist das der Unterschied
 * zwischen „läuft" und „Port belegt" — und nach der Einrichtung wäre es eine
 * Suche in der `.env`. Geändert wird er später unter Deployment → Ports.
 */
export function InstallAppPicker({
  apps,
  ports,
  seedDemoContent,
  busy,
  onChangeApps,
  onChangePort,
  onChangeSeed,
}: Props) {
  const activePreset = presetIdFor(apps);
  const conflicts = portConflicts(apps, ports);

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
          const value = ports[entry.id] ?? "";
          const invalid = checked && !isValidPort(value);
          return (
            <div
              key={entry.id}
              className={`install-app-option${checked ? " is-selected" : ""}`}
            >
              {/* Nur die Auswahl liegt im Label — läge das Portfeld darin, würde
                  jeder Klick hinein das Häkchen umschalten. */}
              <label className="install-app-choice">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy}
                  onChange={(event) => toggle(entry.id, event.target.checked)}
                />
                <span className="install-app-body">
                  <span className="install-app-title">
                    <strong>{entry.label}</strong>
                  </span>
                  <span className="install-app-tagline">{entry.tagline}</span>
                  <span className="connector-muted">{entry.description}</span>
                </span>
              </label>
              <label className="install-app-port">
                <span>Port</span>
                <input
                  className={`connector-input${invalid || conflicts.has(entry.id) ? " is-invalid" : ""}`}
                  type="number"
                  inputMode="numeric"
                  min={MIN_SERVICE_PORT}
                  max={MAX_SERVICE_PORT}
                  value={value}
                  disabled={busy || !checked}
                  aria-label={`Port für ${entry.label}`}
                  aria-invalid={invalid || conflicts.has(entry.id)}
                  placeholder={String(entry.defaultPort)}
                  onChange={(event) => onChangePort(entry.id, event.target.value)}
                />
              </label>
            </div>
          );
        })}
      </div>

      {apps.length === 0 ? (
        <div className="connector-banner connector-banner-error">
          Mindestens ein Bereich muss ausgewählt sein.
        </div>
      ) : null}

      {conflicts.size > 0 ? (
        <div className="connector-banner connector-banner-error">
          Zwei Bereiche können nicht denselben Port benutzen — einer von beiden bliebe beim
          Start liegen.
        </div>
      ) : apps.some((id) => !isValidPort(ports[id] ?? "")) ? (
        <div className="connector-banner connector-banner-error">
          Ports müssen ganze Zahlen zwischen {MIN_SERVICE_PORT} und {MAX_SERVICE_PORT} sein.
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
