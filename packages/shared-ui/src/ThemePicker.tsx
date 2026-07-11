"use client";

import { useCallback, useId, useState } from "react";
import { cn } from "./components/cn";
import { applyThemeAppearance, type ThemeAppearance } from "./visual-theme";

export type { ThemeAppearance } from "./visual-theme";

/** Farb-Swatch pro Erscheinungsbild (Hell/Dunkel/50-50-Split für System). */
const DOT_SWATCH: Record<ThemeAppearance, string> = {
  dark: "bg-[#0b1220]",
  light: "bg-[#f8fafc]",
  system: "bg-[linear-gradient(135deg,#0b1220_50%,#f8fafc_50%)]",
};

export const THEME_OPTIONS: {
  value: ThemeAppearance;
  label: string;
  description: string;
}[] = [
  { value: "dark", label: "Dark", description: "Dunkles Erscheinungsbild für Studio und Portal" },
  { value: "light", label: "Light", description: "Helles Erscheinungsbild mit hohem Kontrast" },
  { value: "system", label: "System", description: "Übernimmt die Hell/Dunkel-Einstellung des Geräts" },
];

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
    <fieldset
      className="mb-5 min-w-0 border-0 p-0"
      aria-labelledby={legendId}
      aria-describedby={hintId}
    >
      <legend id={legendId} className="mb-1.5 block text-sm font-semibold text-foreground">
        {legend}
      </legend>
      <p id={hintId} className="mb-3.5 text-xs leading-normal text-[var(--uwe-fg-subtle)]">
        Wähle ein Erscheinungsbild. Die Auswahl wird beim Speichern übernommen.
      </p>
      <div className="grid grid-cols-3 gap-[0.65rem] max-[960px]:grid-cols-1">
        {THEME_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              /* is-selected bleibt als reiner Zustands-Marker (Tests/Debugging). */
              className={cn(
                "relative flex min-h-[var(--uwe-touch-min)] cursor-pointer flex-col items-center gap-[0.45rem] rounded-xl border px-2 py-3 text-center focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--uwe-focus-ring)]",
                selected
                  ? "is-selected border-[color-mix(in_srgb,var(--uwe-accent)_65%,transparent)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--uwe-accent)_25%,transparent)]"
                  : "border-[var(--uwe-border-muted)]",
                "bg-[var(--uwe-surface)]",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                aria-label={`${option.label}: ${option.description}`}
                className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
              />
              <span
                className={cn(
                  "block h-11 w-11 rounded-full border-2 border-[color-mix(in_srgb,var(--uwe-border)_200%,transparent)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
                  DOT_SWATCH[option.value],
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "text-[0.85rem] font-semibold",
                  selected ? "text-primary" : "text-foreground",
                )}
              >
                {option.label}
              </span>
              {selected && <span className="sr-only">Aktiv ausgewählt</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
