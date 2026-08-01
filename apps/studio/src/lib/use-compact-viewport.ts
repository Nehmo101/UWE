"use client";

import { useEffect, useState } from "react";

/** Tailwinds `lg`-Grenze. Darunter ist kein Platz für zwei Lesespalten. */
const COMPACT_QUERY = "(max-width: 1023.98px)";

/**
 * Ist der Bildschirm zu schmal für den Splitscreen?
 *
 * Das lässt sich hier **nicht** über `lg:hidden` erledigen: Radix hängt den
 * Inhalt eines `Sheet` per Portal an `document.body`, wo eine Klasse am
 * umgebenden `div` nicht mehr greift. Die Schublade würde also auch auf dem
 * großen Bildschirm über dem Text liegen — genau das, was der Splitscreen
 * verhindern soll.
 *
 * Startet mit `false`, damit Server- und Client-Ausgabe beim ersten Rendern
 * übereinstimmen; die echte Breite kommt im Effekt hinterher.
 */
export function useCompactViewport(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const query = window.matchMedia(COMPACT_QUERY);
    const update = () => setCompact(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return compact;
}
