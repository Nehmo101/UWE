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

/**
 * Alle zwanzig Clips sind gleich lang: 5,1 s Rohmaterial, 1,6-fach verlangsamt
 * und als Pendelschnitt (vorwärts, dann rückwärts) zusammengesetzt — siehe
 * `scripts/build-scene-motion.mjs`. Der Pendelschnitt ist kein Effekt, sondern
 * die Reparatur einer sichtbaren Naht: Anfangs- und Endbild der Rohclips
 * unterscheiden sich deutlich, ein einfacher `loop` würde zurückspringen.
 */
const D = 16.2;

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
      desktop: entry("center 42%", D, "Hochtal am Vormittag; vier Wurzeln als verdrehte Strangbündel, unten vielbeinige Wurzelfüße über Fels und Fluss, oben vom Bildrand abgeschnitten. Blattplattformen mit winzigen Bauten und ein Wasserfall geben den Maßstab.", true),
      mobil: entry("center 38%", D, "Dasselbe Tal hochkant; ein Wurzelbündel trägt das Bild, die untere Hälfte bleibt Wiese und Fluss.", true),
    },
    dunkel: {
      desktop: entry("center 42%", D, "Dasselbe Hochtal nach Sonnenuntergang; das Licht kommt aus den Rillen zwischen den Strängen, nicht durch die Oberfläche. Nebel steht im Tal.", true),
      mobil: entry("center 38%", D, "Nachtfassung hochkant; glimmende Rillen im Wurzelbündel, ruhige dunkle Wiese unten.", true),
    },
  },
  family: {
    hell: {
      desktop: entry("center 48%", D, "Bewohnter Garten zwischen aufsteigenden Wurzelsäulen; Nachmittagslicht, bewegte Blätter, untere Bildhälfte offene Wiese.", true),
      mobil: entry("center 45%", D, "Gartenausschnitt hochkant; Wurzelsäule seitlich, offener Himmel und Wiese in der Mitte.", true),
    },
    dunkel: {
      desktop: entry("center 48%", D, "Derselbe Garten am Abend; Fensterlichter, vereinzelte Glühwürmchen, ruhige Luft.", true),
      mobil: entry("center 45%", D, "Abendgarten hochkant; Laternenlicht unten, dunkler Himmel oben.", true),
    },
  },
  portal: {
    hell: {
      desktop: entry("center 44%", D, "Küstenflachwasser mit drei Wurzelbündeln, die in ihren eigenen Spiegelungen stehen; Wurzelfüße greifen über halb versunkenen Fels, ein Wasserfall fällt ins Meer. Fernes Tor am Horizont.", true),
      mobil: entry("center 40%", D, "Küste hochkant; ein Wurzelbündel mit seiner Spiegelung, Wasserfläche unten ruhig.", true),
    },
    dunkel: {
      desktop: entry("center 44%", D, "Dieselbe Küste bei Nacht; Mondsichel und Mondbahn auf dem Wasser, warme Fensterlichter in den Blattplattformen.", true),
      mobil: entry("center 40%", D, "Nachtküste hochkant; Mondbahn im Wasser, dunkle ruhige Fläche unten.", true),
    },
  },
  studio: {
    hell: {
      desktop: entry("center 52%", D, "Werkstattterrasse in der Astgabel eines Wurzelbündels; die Wurzel spreizt sich und trägt die Diele. Tisch, Papierrollen, Laterne. Untere Bildhälfte und linke Seite bleiben blanke Diele — die ruhigste der zehn Kompositionen.", true),
      mobil: entry("center 50%", D, "Werkstatt hochkant; Wurzelbündel rechts, Diele unten, offener Himmel links.", true),
    },
    dunkel: {
      desktop: entry("center 52%", D, "Dieselbe Werkstatt bei Nacht; die Laterne brennt, die Umgebung liegt in ruhigem Blau.", true),
      mobil: entry("center 50%", D, "Nachtwerkstatt hochkant; ein Lichtkegel unten, dunkles Wurzelbündel und Himmel oben.", true),
    },
  },
  brain: {
    hell: {
      desktop: entry("center 46%", D, "Stiller Hain aus Wurzelsäulen in spiegelglattem Wasser; dazwischen schwebende Lichtpunkte an dünnen Fäden — ein angedeutetes Wissensnetz, keine Gehirngrafik. Dämmerung.", true),
      mobil: entry("center 44%", D, "Hain hochkant; Wurzeln rahmen seitlich, Spiegelfläche in der unteren Hälfte.", true),
    },
    dunkel: {
      desktop: entry("center 46%", D, "Derselbe Hain in tiefer Nacht; Lichtpunkte und ihre Spiegelung im Wasser.", true),
      mobil: entry("center 44%", D, "Nachthain hochkant; Lichtpunkte oben, ruhige dunkle Spiegelfläche unten.", true),
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
