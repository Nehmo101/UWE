"use client";

import { useEffect, useState } from "react";
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
 * **Hydration:** `ThemeProvider` initialisiert seinen State auf dem Server aus
 * den Server-Vorgaben, im Browser aber direkt aus dem localStorage. Wer daraus
 * Text oder Attribute rendert, erzeugt einen Mismatch, sobald das gespeicherte
 * Theme vom Server-Default abweicht (React-Fehler #418 in Produktion). Deshalb:
 *   - die Knopfstellung kommt aus CSS am `data-uwe-theme` von `<html>`, das das
 *     Bootstrap-Script schon vor dem ersten Paint richtig setzt — der Schalter
 *     steht dadurch sogar korrekt, bevor React überhaupt hydratisiert,
 *   - zustandsabhängige a11y-Attribute erscheinen erst nach dem Mount.
 * Der erste Client-Render ist damit identisch zum SSR-Markup.
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = preferences.themeId;
  const isGhibli = current === "uwe-ghibli-tag" || current === "uwe-ghibli-nacht";
  // Wer ein anderes Theme fährt, landet mit dem ersten Klick im Nacht-Design —
  // das ist der sichtbare Wechsel, den ein Klick auf ☾ verspricht.
  const next = isGhibli ? GHIBLI_COUNTERPART[current] : "uwe-ghibli-nacht";
  const dark = isGhibli && GHIBLI_MODE_BY_THEME[current] === "dunkel";

  return (
    <button
      type="button"
      onClick={() => updatePreferences({ themeId: next })}
      className={className ? `uwe-mode-toggle ${className}` : "uwe-mode-toggle"}
      data-size={size}
      aria-pressed={mounted ? dark : undefined}
      title={
        mounted
          ? dark
            ? "Auf Hell umschalten"
            : "Auf Dunkel umschalten"
          : "Design umschalten"
      }
    >
      <span aria-hidden="true">☀</span>
      <span className="uwe-mode-toggle__track" aria-hidden="true">
        <span className="uwe-mode-toggle__knob" />
      </span>
      <span aria-hidden="true">☾</span>
    </button>
  );
}
