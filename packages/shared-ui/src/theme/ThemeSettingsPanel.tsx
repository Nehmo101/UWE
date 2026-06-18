"use client";

import { THEME_LIST } from "./themes";
import { useUweTheme } from "./ThemeProvider";
import type {
  BackgroundPatternId,
  DensityId,
  FontFamilyId,
} from "./tokens";

const BACKGROUND_OPTIONS: { id: BackgroundPatternId; label: string }[] = [
  { id: "none", label: "Kein Muster" },
  { id: "dots", label: "Punkte" },
  { id: "synapse", label: "Synapse" },
  { id: "constellation", label: "Sterne" },
  { id: "parchment", label: "Pergament" },
  { id: "noise", label: "Rauschen" },
];

const FONT_OPTIONS: { id: FontFamilyId; label: string }[] = [
  { id: "sans", label: "Sans (Standard)" },
  { id: "mono", label: "Monospace" },
  { id: "serif", label: "Serif" },
];

const DENSITY_OPTIONS: { id: DensityId; label: string }[] = [
  { id: "compact", label: "Kompakt" },
  { id: "comfortable", label: "Komfortabel" },
  { id: "spacious", label: "Großzügig" },
];

function Swatch({ themeId }: { themeId: string }) {
  const theme = THEME_LIST.find((t) => t.id === themeId);
  if (!theme) return null;
  const c = theme.colors;
  return (
    <span className="uwe-theme-swatch-colors" aria-hidden="true">
      <span style={{ background: c.bg }} />
      <span style={{ background: c.panel }} />
      <span style={{ background: c.fg }} />
      <span style={{ background: c.accent }} />
    </span>
  );
}

export function ThemeSettingsPanel() {
  const { preferences, updatePreferences, resetPreferences } = useUweTheme();

  return (
    <section className="uwe-theme-settings" aria-labelledby="uwe-theme-settings-title">
      <h2 id="uwe-theme-settings-title">Erscheinungsbild</h2>
      <p className="uwe-hint">
        Theme-Einstellungen werden lokal in diesem Browser gespeichert. Kein
        Flackern beim Laden — Änderungen gelten sofort.
      </p>

      <fieldset className="uwe-fieldset">
        <legend>Theme</legend>
        <div className="uwe-theme-grid" role="listbox" aria-label="Theme auswählen">
          {THEME_LIST.map((theme) => {
            const active = preferences.themeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`uwe-theme-swatch${active ? " active" : ""}`}
                onClick={() => updatePreferences({ themeId: theme.id })}
              >
                <Swatch themeId={theme.id} />
                <span className="uwe-theme-swatch-label">{theme.label}</span>
                <span className="uwe-theme-swatch-desc">{theme.description}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="uwe-form uwe-theme-options">
        <label>
          Schrift
          <select
            value={preferences.font}
            onChange={(e) =>
              updatePreferences({ font: e.target.value as FontFamilyId })
            }
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          UI-Dichte
          <select
            value={preferences.density}
            onChange={(e) =>
              updatePreferences({ density: e.target.value as DensityId })
            }
          >
            {DENSITY_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Hintergrund
          <select
            value={preferences.background}
            onChange={(e) =>
              updatePreferences({
                background: e.target.value as BackgroundPatternId,
              })
            }
          >
            {BACKGROUND_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="uwe-checkbox">
          <input
            type="checkbox"
            checked={preferences.frostedGlass}
            onChange={(e) =>
              updatePreferences({ frostedGlass: e.target.checked })
            }
          />
          Frosted Glass (Panels &amp; Karten)
        </label>

        <label>
          Hintergrund-Intensität
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(preferences.bgEffectIntensity * 100)}
            onChange={(e) =>
              updatePreferences({
                bgEffectIntensity: Number(e.target.value) / 100,
              })
            }
          />
        </label>

        <label>
          UI-Skalierung (experimentell)
          <input
            type="range"
            min={90}
            max={110}
            value={Math.round(preferences.uiScale * 100)}
            onChange={(e) =>
              updatePreferences({ uiScale: Number(e.target.value) / 100 })
            }
          />
          <span className="uwe-field-hint">
            {Math.round(preferences.uiScale * 100)}% — Layout sollte stabil bleiben.
          </span>
        </label>
      </div>

      <div className="uwe-form-actions">
        <button
          type="button"
          className="uwe-btn uwe-btn-ghost"
          onClick={() => resetPreferences()}
        >
          Auf Standard zurücksetzen
        </button>
      </div>
    </section>
  );
}
