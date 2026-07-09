"use client";

import { useEffect, useRef, useState } from "react";
import {
  THEME_LIST,
  getTheme,
  getCustomThemes,
  getCustomThemesForScope,
} from "./themes";
import type {
  AppScope,
  BackgroundPatternId,
  DensityId,
  ElementOverrideTokens,
  FontFamilyId,
} from "./tokens";
import type { UweThemePreferences } from "./storage";

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

const ELEMENT_OVERRIDE_FIELDS: {
  key: keyof ElementOverrideTokens;
  label: string;
  kind: "color" | "font";
}[] = [
  { key: "chromeBg", label: "Chrome-Hintergrund", kind: "color" },
  { key: "chromeFg", label: "Chrome-Text", kind: "color" },
  { key: "headingFg", label: "Überschrift-Farbe", kind: "color" },
  { key: "headingFont", label: "Überschrift-Schrift", kind: "font" },
  { key: "cardBg", label: "Karten-Hintergrund", kind: "color" },
  { key: "cardBorder", label: "Karten-Rahmen", kind: "color" },
];

function ElementOverrideFields({
  overrides,
  updateOverrides,
}: {
  overrides: ElementOverrideTokens | undefined;
  updateOverrides: (patch: Partial<ElementOverrideTokens> | undefined) => void;
}) {
  const current = overrides ?? {};

  return (
    <fieldset className="uwe-fieldset">
      <legend>Zonen-Farben (Design v2)</legend>
      <p className="uwe-hint">
        Optionale Feinanpassung für Chrome, Überschriften und Karten. Leer lassen für Theme-Standard.
      </p>
      <div className="uwe-form uwe-theme-options">
        {ELEMENT_OVERRIDE_FIELDS.map(({ key, label, kind }) => {
          if (kind === "font") {
            return (
              <label key={key}>
                {label}
                <select
                  value={
                    current.headingFont === "mono" ||
                    current.headingFont === "sans" ||
                    current.headingFont === "serif"
                      ? current.headingFont
                      : ""
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) {
                      const { headingFont: _removed, ...rest } = current;
                      updateOverrides(Object.keys(rest).length > 0 ? rest : undefined);
                      return;
                    }
                    updateOverrides({ ...current, headingFont: value });
                  }}
                >
                  <option value="">Theme-Standard</option>
                  {FONT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          const colorValue =
            current[key]?.startsWith("#") ? current[key]! : "#000000";

          return (
            <label key={key}>
              {label}
              <span
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "center",
                }}
              >
                <input
                  type="color"
                  value={current[key]?.startsWith("#") ? current[key]! : colorValue}
                  onChange={(e) =>
                    updateOverrides({ ...current, [key]: e.target.value })
                  }
                  aria-label={`${label} wählen`}
                />
                <input
                  type="text"
                  value={current[key] ?? ""}
                  placeholder="Theme-Standard"
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    if (!value) {
                      const next = { ...current };
                      delete next[key];
                      updateOverrides(Object.keys(next).length > 0 ? next : undefined);
                      return;
                    }
                    updateOverrides({ ...current, [key]: value });
                  }}
                />
                {current[key] && (
                  <button
                    type="button"
                    className="uwe-btn uwe-btn-ghost uwe-btn-sm"
                    onClick={() => {
                      const next = { ...current };
                      delete next[key];
                      updateOverrides(Object.keys(next).length > 0 ? next : undefined);
                    }}
                  >
                    Zurücksetzen
                  </button>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Swatch({ themeId }: { themeId: string }) {
  const theme = getTheme(themeId);
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

export function ThemePreferencesFields({
  preferences,
  updatePreferences,
  onReset,
  scope,
}: {
  preferences: UweThemePreferences;
  updatePreferences: (patch: Partial<UweThemePreferences>) => void;
  onReset?: () => void;
  /** Filters custom themes to this app scope; shows all custom themes when omitted. */
  scope?: AppScope;
}) {
  const customThemes = scope ? getCustomThemesForScope(scope) : getCustomThemes();
  const themeItems = [...THEME_LIST, ...customThemes];
  return (
    <>
      <fieldset className="uwe-fieldset">
        <legend>Theme</legend>
        <div className="uwe-theme-grid" role="listbox" aria-label="Theme auswählen">
          {themeItems.map((theme) => {
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

      <ElementOverrideFields
        overrides={preferences.elementOverrides}
        updateOverrides={(elementOverrides) =>
          updatePreferences({ elementOverrides })
        }
      />

      {onReset && (
        <div className="uwe-form-actions">
          <button type="button" className="uwe-btn uwe-btn-ghost" onClick={onReset}>
            Auf Standard zurücksetzen
          </button>
        </div>
      )}
    </>
  );
}

const PERSIST_DEBOUNCE_MS = 800;

export function ThemeScopeSettingsPanel({
  title,
  description,
  preferences,
  onPersist,
  scope,
}: {
  title: string;
  description: string;
  preferences: UweThemePreferences;
  onPersist: (preferences: UweThemePreferences) => Promise<string | void>;
  scope?: AppScope;
}) {
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipPersistRef = useRef(true);

  useEffect(() => {
    setLocalPreferences(preferences);
    skipPersistRef.current = true;
  }, [preferences]);

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = setTimeout(() => {
      setSyncState("syncing");
      void onPersist(localPreferences)
        .then(() => setSyncState("synced"))
        .catch(() => setSyncState("error"));
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [localPreferences, onPersist]);

  const updatePreferences = (patch: Partial<UweThemePreferences>) => {
    setLocalPreferences((prev) => ({ ...prev, ...patch }));
  };

  return (
    <section className="uwe-theme-settings" aria-labelledby={`${title}-title`}>
      <h3 id={`${title}-title`}>{title}</h3>
      <p className="uwe-hint">{description}</p>
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
          Server-Sync fehlgeschlagen.
        </p>
      )}
      <ThemePreferencesFields
        preferences={localPreferences}
        updatePreferences={updatePreferences}
        scope={scope}
      />
    </section>
  );
}
