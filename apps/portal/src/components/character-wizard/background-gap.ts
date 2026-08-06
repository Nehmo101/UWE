/**
 * Die Lücke zwischen Katalog und Klassenwahl — an einer Stelle gerechnet.
 *
 * Seit den Regeln von 2024 hängt die Attributsverteilung am Hintergrund. Das
 * SRD 5.2.1 liefert davon aber nur vier, und ihre Attributstripel decken nicht
 * jede Klasse ab: Paladin (STÄ+CHA), Mönch und Waldläufer (beide GES+WEI)
 * finden keinen fertigen Hintergrund, der **beide** Primärattribute anhebt.
 *
 * Wer das nicht erfährt, wählt ahnungslos einen Hintergrund, der genau den
 * Wert liegen lässt, auf dem seine Klasse steht. Deshalb steht der Befund
 * nicht in einer Doku, sondern in zwei Schritten der Oberfläche: als Zeile auf
 * der Klassenkachel und als Hinweis über den Hintergrund-Kacheln.
 *
 * Die Rechnung selbst macht `classesWithoutMatchingBackground` im Regelpaket.
 * Hier wird sie einmal beim Laden ausgeführt — der Katalog ändert sich zur
 * Laufzeit nicht — und beiden Schritten als fertige Antwort hingelegt.
 */

import { BACKGROUNDS, CLASSES, classesWithoutMatchingBackground } from "@uwe/character-creator";

/** Die Klassen, für die kein Katalog-Hintergrund beide Primärattribute hebt. */
export const CLASSES_WITHOUT_BACKGROUND = classesWithoutMatchingBackground(CLASSES, BACKGROUNDS);

const STRANDED_KEYS = new Set(CLASSES_WITHOUT_BACKGROUND.map((entry) => entry.key));

/** Steckt diese Klasse in der Lücke? */
export function lacksMatchingBackground(classKey: string | null | undefined): boolean {
  return typeof classKey === "string" && STRANDED_KEYS.has(classKey);
}
