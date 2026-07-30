import type { SceneArea, SceneMode, SceneVariant } from "./scenePools";

/**
 * Bewegte Bühne — das Register der Hintergrund-Clips.
 *
 * Warum eine eigene Tabelle neben `scenePools.ts`: die Standbilder rotieren
 * täglich aus einem Pool, die Clips tun das nicht. Pro Bereich gibt es genau
 * eine Tages- und eine Nachtszene, jeweils in einer Desktop- und einer
 * Mobil-Fassung — zehn Szenen, zwanzig Dateien. Ein Pool wäre hier falsch:
 * ein Hintergrundvideo, das sich täglich ändert, ist kein Wiedererkennungswert,
 * sondern Unruhe.
 *
 * Dateinamen sind vorhersagbar und werden **nicht** einzeln eingetragen:
 *   /scenes/motion/<area>-<mode>-<variant>.mp4    (H.264, Fallback)
 *   /scenes/motion/<area>-<mode>-<variant>.webm   (VP9/AV1, bevorzugt)
 *   /scenes/motion/<area>-<mode>-<variant>.avif   (Poster, bevorzugt)
 *   /scenes/motion/<area>-<mode>-<variant>.webp   (Poster, Fallback)
 *
 * `available` ist der Schalter, der zählt: steht er auf `false`, rendert
 * `SceneStage` ausschließlich die gemalte Standbild-Bühne aus `PaintedScene`.
 * Kein Platzhalter, kein schwarzes Rechteck, kein Ladefehler in der Konsole —
 * die Seite sieht dann exakt so aus wie vor der Video-Ebene. Damit ist das
 * Einhängen echter Clips später eine reine Datenänderung in dieser Datei.
 */

export const SCENE_MOTION_DIR = "/scenes/motion";

export interface SceneMotionEntry {
  /**
   * Liegen die Dateien vor? Nur dann versucht `SceneStage` überhaupt zu laden.
   * Bewusst pro Eintrag und nicht global — eine Szene kann fertig sein, während
   * die nächste noch fehlt.
   */
  available: boolean;
  /**
   * `object-position` des Videos. Für die Mobilfassung ist das der kuratierte
   * Bildausschnitt: der Clip ist bereits hochkant gerendert, aber je nach
   * Motiv sitzt der Horizont nicht in der Mitte.
   */
  objectPosition: string;
  /** Sekunden — nur für die Dokumentation und den Asset-Report. */
  durationSeconds: number;
  /** Kurzbeschreibung der Szene; erscheint im Asset-Register. */
  description: string;
}

type MotionTable = Record<SceneArea, Record<SceneMode, Record<SceneVariant, SceneMotionEntry>>>;

const entry = (
  objectPosition: string,
  durationSeconds: number,
  description: string,
  available = false,
): SceneMotionEntry => ({ available, objectPosition, durationSeconds, description });

/**
 * Die zehn Szenen. Tag und Nacht eines Bereichs zeigen bewusst **dieselbe
 * Umgebung** aus derselben Kameraposition — der Hell/Dunkel-Wechsel soll sich
 * wie ein Tageszeitenwechsel anfühlen, nicht wie ein Ortswechsel.
 */
export const SCENE_MOTION: MotionTable = {
  landing: {
    hell: {
      desktop: entry("center 42%", 10, "Weites Hochtal am Vormittag; zwei kolossale Elfenbein-Wurzeln spannen sich in der Ferne über den Himmel."),
      mobil: entry("center 38%", 10, "Dasselbe Tal hochkant; die Wurzelbögen sitzen im oberen Drittel, die untere Hälfte bleibt offene Wiese."),
    },
    dunkel: {
      desktop: entry("center 42%", 10, "Dasselbe Hochtal nach Sonnenuntergang; die Wurzeln glimmen von innen, Nebel steht im Tal."),
      mobil: entry("center 38%", 10, "Nachtfassung hochkant; Sternenband über den Wurzelbögen, ruhige dunkle Wiese unten."),
    },
  },
  family: {
    hell: {
      desktop: entry("center 48%", 10, "Bewohnter Garten zwischen zwei Wurzelstämmen; warmes Nachmittagslicht, bewegte Blätter."),
      mobil: entry("center 45%", 10, "Gartenausschnitt hochkant; Wurzelstamm links, offener Himmel und Wiese in der Bildmitte."),
    },
    dunkel: {
      desktop: entry("center 48%", 10, "Derselbe Garten am Abend; Fensterlichter, vereinzelte Glühwürmchen, ruhige Luft."),
      mobil: entry("center 45%", 10, "Abendgarten hochkant; Laternenlicht unten links, dunkler Himmel oben."),
    },
  },
  portal: {
    hell: {
      desktop: entry("center 44%", 10, "Weiter Blick über eine Küstenebene; eine Wurzelbrücke führt zu einem fernen Tor."),
      mobil: entry("center 40%", 10, "Küstenblick hochkant; die Brücke zieht diagonal nach oben, Wasserfläche unten ruhig."),
    },
    dunkel: {
      desktop: entry("center 44%", 10, "Dieselbe Küste bei Nacht; warme Lichter am fernen Tor, Mondbahn auf dem Wasser."),
      mobil: entry("center 40%", 10, "Nachtküste hochkant; Lichterkette am Horizont, dunkles ruhiges Wasser."),
    },
  },
  studio: {
    hell: {
      desktop: entry("center 52%", 10, "Werkstattterrasse an einem Wurzelstamm; Papier und Laternen dezent, viel freie Fläche."),
      mobil: entry("center 50%", 10, "Werkstatt hochkant; Stamm rechts, Arbeitsfläche und Himmel offen."),
    },
    dunkel: {
      desktop: entry("center 52%", 10, "Dieselbe Werkstatt bei Nacht; Laternenlicht warm, Umgebung in ruhigem Blau."),
      mobil: entry("center 50%", 10, "Nachtwerkstatt hochkant; ein Lichtkegel unten, dunkler Stamm und Himmel oben."),
    },
  },
  brain: {
    hell: {
      desktop: entry("center 46%", 10, "Stiller Hain aus hellen Wurzeln über einer Wasserfläche; Dunst, schwebende Partikel."),
      mobil: entry("center 44%", 10, "Hain hochkant; Wurzeln rahmen links und rechts, Wasserfläche in der unteren Hälfte."),
    },
    dunkel: {
      desktop: entry("center 46%", 10, "Derselbe Hain bei Nacht; Lichtpunkte in den Wurzeln, Spiegelung im Wasser."),
      mobil: entry("center 44%", 10, "Nachthain hochkant; Lichtpunkte oben, ruhige dunkle Spiegelfläche unten."),
    },
  },
};

export function sceneMotionFor(
  area: SceneArea,
  mode: SceneMode,
  variant: SceneVariant,
): SceneMotionEntry {
  return SCENE_MOTION[area][mode][variant];
}

/** Basisname ohne Endung — `SceneStage` hängt `.webm` / `.mp4` / `.avif` an. */
export function sceneMotionBase(
  area: SceneArea,
  mode: SceneMode,
  variant: SceneVariant,
  basePath = "",
): string {
  const prefix = basePath.replace(/\/$/, "");
  return `${prefix}${SCENE_MOTION_DIR}/${area}-${mode}-${variant}`;
}

/** Hat ein Bereich überhaupt Clips? Steuert, ob `SceneStage` Client-JS lädt. */
export function hasSceneMotion(area: SceneArea): boolean {
  const modes = SCENE_MOTION[area];
  return Object.values(modes).some((variants) =>
    Object.values(variants).some((it) => it.available),
  );
}

/** Alle Dateien eines Bereichs — das Kopier-Skript liest genau diese Liste. */
export function motionFilesForAreas(areas: readonly SceneArea[]): string[] {
  const files: string[] = [];
  for (const area of areas) {
    for (const mode of ["hell", "dunkel"] as const) {
      for (const variant of ["desktop", "mobil"] as const) {
        if (!SCENE_MOTION[area][mode][variant].available) continue;
        const base = `${area}-${mode}-${variant}`;
        files.push(`${base}.mp4`, `${base}.webm`, `${base}.avif`, `${base}.webp`);
      }
    }
  }
  return files.sort();
}
