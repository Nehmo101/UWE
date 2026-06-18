"use client";

import { useCallback, useId, useState } from "react";
import type { ThemeAppearance } from "./visual-theme";

export type { ThemeAppearance } from "./visual-theme";

export const THEME_OPTIONS: {
  value: ThemeAppearance;
  label: string;
  description: string;
}[] = [
  { value: "dark", label: "Dark", description: "Dunkles Erscheinungsbild für Studio und Portal" },
  { value: "light", label: "Light", description: "Helles Erscheinungsbild mit hohem Kontrast" },
  { value: "system", label: "System", description: "Übernimmt die Hell/Dunkel-Einstellung des Geräts" },
];

export function applyThemeAppearance(theme: ThemeAppearance) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

export interface ThemePickerProps {
  name?: string;
  defaultValue?: ThemeAppearance;
  /** Live preview while choosing (sets data-theme on documentElement). */
  preview?: boolean;
  legend?: string;
}

export function ThemePicker({
  name = "theme",
  defaultValue = "dark",
  preview = true,
  legend = "Theme / Erscheinungsbild",
}: ThemePickerProps) {
  const legendId = useId();
  const hintId = useId();
  const [value, setValue] = useState<ThemeAppearance>(defaultValue);

  const onChange = useCallback(
    (next: ThemeAppearance) => {
      setValue(next);
      if (preview) applyThemeAppearance(next);
    },
    [preview],
  );

  return (
    <fieldset className="uwe-theme-picker" aria-labelledby={legendId} aria-describedby={hintId}>
      <legend id={legendId} className="uwe-theme-picker-legend">
        {legend}
      </legend>
      <p id={hintId} className="uwe-theme-picker-hint">
        Wähle ein Erscheinungsbild. Die Auswahl wird beim Speichern übernommen.
      </p>
      <div className="uwe-theme-picker-options">
        {THEME_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={`uwe-theme-picker-option${selected ? " is-selected" : ""}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                aria-label={`${option.label}: ${option.description}`}
              />
              <span
                className={`uwe-theme-swatch uwe-theme-swatch-${option.value}`}
                aria-hidden="true"
              />
              <span className="uwe-theme-picker-label">{option.label}</span>
              {selected && (
                <span className="uwe-theme-picker-active uwe-sr-only">Aktiv ausgewählt</span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
