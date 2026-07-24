import {
  getScenePool,
  SCENE_FILE_EXTENSION,
  SCENE_PUBLIC_DIR,
  type Scene,
  type SceneArea,
  type SceneMode,
  type SceneVariant,
} from "./scenePools";

export type SceneCadence = "daily" | "weekly" | "off";

/**
 * Zeitzone, an der der Tageswechsel hängt. Fix, nicht die Serverzone: der
 * Index wird serverseitig berechnet und als Prop durchgereicht, und eine
 * abweichende Serverzone würde das Bild zur falschen Stunde umspringen lassen.
 */
export const SCENE_TIME_ZONE = "Europe/Berlin";

/** Auswahlregel — rein funktional, kein State. Negative Indizes inklusive. */
export function pickScene<T>(pool: readonly T[], dayIndex: number): T {
  if (pool.length === 0) {
    throw new Error("pickScene: pool must not be empty");
  }
  const size = pool.length;
  return pool[(((dayIndex % size) + size) % size)];
}

const DATE_PART_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function zonedYmd(now: Date, timeZone: string): [number, number, number] {
  let formatter = DATE_PART_FORMATTERS.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    DATE_PART_FORMATTERS.set(timeZone, formatter);
  }
  // en-CA formats as YYYY-MM-DD, which parses without locale guesswork.
  const [year, month, day] = formatter.format(now).split("-").map(Number);
  return [year, month, day];
}

/**
 * Tagesnummer seit der Epoche, gezählt an **lokaler** Mitternacht der
 * angegebenen Zone — nicht `Date.now() / 86400000`, sonst springt das Bild je
 * Zeitzone zur falschen Stunde.
 *
 * Abweichung vom Handoff-Snippet: dort steht
 * `new Date(y, m, d).getTime() / 864e5`. Das ist eine *lokale* Mitternacht,
 * durch eine *UTC*-Tageslänge geteilt — östlich von UTC liefert es deshalb den
 * Index des Vortags. Für die Rotation ist das folgenlos (der Wert bleibt pro
 * Tag konstant und springt zur richtigen Stunde), aber `Date.UTC` auf den
 * zonen-lokalen Kalenderteilen ist genauso stabil und dabei korrekt.
 */
export function dayIndex(
  now: Date = new Date(),
  options: { cadence?: SceneCadence; timeZone?: string } = {},
): number {
  const { cadence = "daily", timeZone = SCENE_TIME_ZONE } = options;
  if (cadence === "off") return 0;
  const [year, month, day] = zonedYmd(now, timeZone);
  const days = Math.floor(Date.UTC(year, month - 1, day) / 864e5);
  return cadence === "weekly" ? Math.floor(days / 7) : days;
}

export interface ScenePair {
  /** Tagbild — die untere Ebene, immer sichtbar. */
  day: Scene;
  /** Nachtbild — die obere Ebene, im Dunkelmodus eingeblendet. */
  night: Scene;
}

/**
 * Beide Ebenen eines Tages. Es sind immer beide, unabhängig vom Modus: der
 * Hell/Dunkel-Crossfade darf nicht erst beim Umschalten nachladen.
 */
export function resolveScenePair(
  area: SceneArea,
  variant: SceneVariant,
  index: number,
): ScenePair {
  return {
    day: pickScene(getScenePool(area, "hell", variant), index),
    night: pickScene(getScenePool(area, "dunkel", variant), index),
  };
}

/**
 * Öffentliche URL einer Szene. `basePath` deckt Portal ab, das unter einem
 * konfigurierbaren Unterpfad laufen kann — ein absoluter `/scenes/…`-Pfad
 * bräche dort.
 */
export function sceneUrl(scene: Scene, basePath = ""): string {
  const prefix = basePath.replace(/\/$/, "");
  return `${prefix}${SCENE_PUBLIC_DIR}/${scene.src}${SCENE_FILE_EXTENSION}`;
}

/** CSS-`url(...)`-Wert für die Custom-Property der Szenen-Ebene. */
export function sceneCssUrl(scene: Scene, basePath = ""): string {
  return `url("${sceneUrl(scene, basePath)}")`;
}

export type { Scene, SceneArea, SceneMode, SceneVariant };
