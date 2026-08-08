/**
 * Die Lücke zwischen Katalog und Klassenwahl — an einer Stelle gerechnet.
 *
 * Seit den Regeln von 2024 hängt die Attributsverteilung am Hintergrund. Nur
 * die vier SRD-Hintergründe decken nicht jede Klasse ab (Paladin, Mönch,
 * Waldläufer). Der volle Katalog aus `@uwe/character-creator` schließt diese
 * Lücke — `CLASSES_WITHOUT_BACKGROUND` ist dann leer, und die Oberfläche
 * zeigt keine Stranded-Hinweise mehr.
 *
 * Die Rechnung macht `classesWithoutMatchingBackground` im Regelpaket. Hier
 * wird sie einmal beim Laden ausgeführt — der Katalog ändert sich zur Laufzeit
 * nicht — und beiden Schritten als fertige Antwort hingelegt.
 */

import {
  ABILITY_SHORT,
  BACKGROUNDS,
  CLASSES,
  classesWithoutMatchingBackground,
  findClass,
} from "@uwe/character-creator";

/** Die Klassen, für die kein Katalog-Hintergrund beide Primärattribute hebt. */
export const CLASSES_WITHOUT_BACKGROUND = classesWithoutMatchingBackground(CLASSES, BACKGROUNDS);

const STRANDED_KEYS = new Set(CLASSES_WITHOUT_BACKGROUND.map((entry) => entry.key));

/** Steckt diese Klasse in der Lücke? */
export function lacksMatchingBackground(classKey: string | null | undefined): boolean {
  return typeof classKey === "string" && STRANDED_KEYS.has(classKey);
}

/**
 * Aufgezählte Klassen mit Primärattributen — aus der Rechnung, nicht aus dem
 * Gedächtnis. Leer, wenn der volle Katalog die Lücke schließt.
 */
export const STRANDED_CLASS_SUMMARY: string = (() => {
  const parts = CLASSES_WITHOUT_BACKGROUND.map((entry) => {
    const found = findClass(entry.key);
    if (!found) return entry.name;
    return `${entry.name} (${found.primaryAbilities.map((key) => ABILITY_SHORT[key]).join("+")})`;
  });
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`;
})();
