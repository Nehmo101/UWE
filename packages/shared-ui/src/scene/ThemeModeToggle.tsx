"use client";

import { useUweTheme } from "../theme/ThemeProvider";
import { GHIBLI_COUNTERPART, GHIBLI_MODE_BY_THEME } from "../theme/themes-ghibli";

/**
 * ☀ / Schalter / ☾ — schaltet zwischen den beiden Hälften der „Gemalten Welt".
 *
 * Der Umschalter setzt schlicht die Theme-ID; damit tragen die bestehende
 * Persistenz, der DB-Sync und das Anti-FOUC-Bootstrap den Wechsel. Es gibt
 * bewusst keinen zweiten Mode-State, der mit dem Theme aus dem Tritt geraten
 * könnte.
 *
 * Der Knopf bewegt sich per CSS (`left`), das Szenenbild blendet über die
 * Theme-Attribut-gebundenen Opazitäten — kein JavaScript in der Animation.
 */

export type ThemeModeToggleSize = "nav" | "compact";

export function ThemeModeToggle({
  size = "compact",
  className,
}: {
  /** `nav` ist die größere Pill der Landing-Navigation. */
  size?: ThemeModeToggleSize;
  className?: string;
}) {
  const { preferences, updatePreferences } = useUweTheme();

  const current = preferences.themeId;
  const isGhibli = current === "uwe-ghibli-tag" || current === "uwe-ghibli-nacht";
  // Wer ein anderes Theme fährt, landet mit dem ersten Klick im Nacht-Design —
  // das ist der sichtbare Wechsel, den ein Klick auf ☾ verspricht.
  const next = isGhibli ? GHIBLI_COUNTERPART[current] : "uwe-ghibli-nacht";
  const mode = isGhibli ? GHIBLI_MODE_BY_THEME[current] : "hell";
  const dark = mode === "dunkel";

  return (
    <button
      type="button"
      onClick={() => updatePreferences({ themeId: next })}
      className={
        className
          ? `uwe-mode-toggle ${className}`
          : "uwe-mode-toggle"
      }
      data-size={size}
      data-mode={mode}
      aria-pressed={dark}
      title={dark ? "Auf Hell umschalten" : "Auf Dunkel umschalten"}
    >
      <span aria-hidden="true">☀</span>
      <span className="uwe-mode-toggle__track" aria-hidden="true">
        <span className="uwe-mode-toggle__knob" />
      </span>
      <span aria-hidden="true">☾</span>
      <span className="uwe-visually-hidden">
        {dark ? "Dunkles Design aktiv" : "Helles Design aktiv"}
      </span>
    </button>
  );
}
