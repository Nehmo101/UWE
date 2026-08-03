/**
 * Welche Studio-Routen die gemalte Bühne als Band tragen.
 *
 * Studio war der einzige der fünf Bereiche ganz ohne Szene: die Clips wurden
 * erzeugt (`sceneMotion.ts`, Eintrag `studio`), gebaut und nach
 * `apps/studio/public/scenes/motion/` ausgeliefert — und nie abgerufen, weil
 * keine Route `PaintedScene` einbindet. Die Größe `"studio"` in `SceneHero`
 * (44 px Titel) und `height="band"` in `PaintedScene` waren dafür bereits
 * vorgesehen.
 *
 * Die Regel ist bewusst eine **exakte** Liste und kein Präfix. Studio ist die
 * Arbeitsfläche: ein Wiki-Editor, eine Job-Liste oder das Image Studio haben
 * hinter sich keinen bewegten Hintergrund zu vertragen. Die Bühne markiert die
 * Einstiege — die Stellen, an denen man ankommt und sich orientiert, nicht die,
 * an denen man arbeitet. Deshalb steht hier `/worlds`, aber nicht
 * `/worlds/terra/wiki`.
 *
 * Wer einen Einstieg hinzufügt, trägt ihn hier ein; `studio-scene.test.ts`
 * hält die Liste gegen die Chromeless-Regel gegen, damit keine Route
 * gleichzeitig rahmenlos ist und eine Bühne verlangt.
 */

/**
 * Die Einstiege. Jeder Eintrag ist eine Top-Level-Route, die im Shell rendert
 * und eine eigene Übersicht zeigt.
 */
const SCENE_BAND_PATHS = [
  /** „Alle Welten" — der Landepunkt nach der Anmeldung. */
  "/worlds",
  /** Brain Store — das DnD-Brain. */
  "/brain",
  /** Wissensassistent (owner). */
  "/knowledge",
  /** „Mach weiter" — der tägliche Einstieg in die offene Arbeit. */
  "/continue",
  /** KI & Generatoren. */
  "/ai",
] as const;

const SCENE_BAND_SET: ReadonlySet<string> = new Set(SCENE_BAND_PATHS);

/** Nur zum Prüfen und Dokumentieren — die Laufzeit fragt `hasStudioSceneBand`. */
export const studioSceneBandPaths: readonly string[] = SCENE_BAND_PATHS;

/**
 * Trägt diese Route das Band?
 *
 * Query und ein abschließender Schrägstrich werden abgeschnitten, sonst
 * verfehlt `/worlds/` oder `/worlds?neu=1` den Vergleich — beide sind dieselbe
 * Seite.
 */
export function hasStudioSceneBand(pathname: string): boolean {
  const path = (pathname.split("?")[0] ?? "/").replace(/\/+$/, "");
  return SCENE_BAND_SET.has(path === "" ? "/" : path);
}
