"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../components/cn";
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

/** Native form-control idiom shared by every select/text input in this panel. */
const SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const TEXT_INPUT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const COLOR_INPUT_CLASS =
  "h-9 w-9 rounded-[var(--radius)] border border-input bg-transparent p-1 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const FIELD_LABEL_CLASS = "grid gap-[0.35rem] text-[0.85rem] text-muted-foreground";

function ElementOverrideFields({
  overrides,
  updateOverrides,
}: {
  overrides: ElementOverrideTokens | undefined;
  updateOverrides: (patch: Partial<ElementOverrideTokens> | undefined) => void;
}) {
  const current = overrides ?? {};

  return (
    <fieldset className="grid gap-3 rounded-lg border border-border px-4 py-3">
      <legend className="px-[0.35rem] text-[0.85rem] text-muted-foreground">
        Zonen-Farben (Design v2)
      </legend>
      <p className="text-sm text-muted-foreground">
        Optionale Feinanpassung für Chrome, Überschriften und Karten. Leer lassen für Theme-Standard.
      </p>
      <div className="mt-5 grid w-full max-w-[40rem] gap-4">
        {ELEMENT_OVERRIDE_FIELDS.map(({ key, label, kind }) => {
          if (kind === "font") {
            return (
              <label key={key} className={FIELD_LABEL_CLASS}>
                {label}
                <select
                  className={SELECT_CLASS}
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
            <label key={key} className={FIELD_LABEL_CLASS}>
              {label}
              <span className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  className={COLOR_INPUT_CLASS}
                  value={current[key]?.startsWith("#") ? current[key]! : colorValue}
                  onChange={(e) =>
                    updateOverrides({ ...current, [key]: e.target.value })
                  }
                  aria-label={`${label} wählen`}
                />
                <input
                  type="text"
                  className={TEXT_INPUT_CLASS}
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
                    className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius)] px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
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
    <span
      className="grid h-5 grid-cols-4 gap-[3px] overflow-hidden rounded-[0.35rem]"
      aria-hidden="true"
    >
      <span className="block h-full" style={{ background: c.bg }} />
      <span className="block h-full" style={{ background: c.panel }} />
      <span className="block h-full" style={{ background: c.fg }} />
      <span className="block h-full" style={{ background: c.accent }} />
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
      <fieldset className="grid gap-3 rounded-lg border border-border px-4 py-3">
        <legend className="px-[0.35rem] text-[0.85rem] text-muted-foreground">Theme</legend>
        <div
          className="mt-3 grid grid-cols-2 gap-[0.65rem] sm:grid-cols-3 lg:grid-cols-4"
          role="listbox"
          aria-label="Theme auswählen"
        >
          {themeItems.map((theme) => {
            const active = preferences.themeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  "flex cursor-pointer flex-col gap-[0.35rem] rounded-[0.65rem] border border-border bg-[var(--uwe-surface)] px-[0.65rem] py-[0.65rem] text-left text-foreground transition-colors hover:border-primary hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--uwe-accent)_35%,transparent)]",
                  active && "border-primary shadow-[0_0_0_1px_color-mix(in_srgb,var(--uwe-accent)_35%,transparent)]",
                )}
                onClick={() => updatePreferences({ themeId: theme.id })}
              >
                <Swatch themeId={theme.id} />
                <span className="text-[0.82rem] font-semibold text-foreground">{theme.label}</span>
                <span className="text-[length:var(--uwe-text-2xs)] leading-[1.35] text-[var(--uwe-fg-subtle)]">
                  {theme.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 grid w-full max-w-[40rem] gap-4">
        <label className={FIELD_LABEL_CLASS}>
          Schrift
          <select
            className={SELECT_CLASS}
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

        <label className={FIELD_LABEL_CLASS}>
          UI-Dichte
          <select
            className={SELECT_CLASS}
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

        <label className={FIELD_LABEL_CLASS}>
          Hintergrund
          <select
            className={SELECT_CLASS}
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

        <label className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.frostedGlass}
            onChange={(e) =>
              updatePreferences({ frostedGlass: e.target.checked })
            }
          />
          Frosted Glass (Panels &amp; Karten)
        </label>

        <label className={FIELD_LABEL_CLASS}>
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

        <label className={FIELD_LABEL_CLASS}>
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
          <span className="text-[length:var(--uwe-text-2xs)] leading-[1.4] text-muted-foreground">
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
        // TODO(design-kit): uwe-form-actions kept — its mobile media query
        // (uwe.css) turns this into a sticky safe-area-aware bottom action bar;
        // no utility equivalent is established yet for that behavior.
        <div className="uwe-form-actions">
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            onClick={onReset}
          >
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
    <section className="max-w-3xl" aria-labelledby={`${title}-title`}>
      <h3 id={`${title}-title`}>{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
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
