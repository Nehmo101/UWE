/**
 * Szenen-Pools der „Gemalten Welt".
 *
 * Jeder Bereich hat pro Modus und Viewport einen kuratierten Pool; die Auswahl
 * wechselt täglich (siehe `pickScene`). Einzelne Motive erscheinen bewusst in
 * mehreren Pools — mit eigenem Crop. Die Tabelle ist 1:1 aus dem Logik-Teil des
 * Prototyps übernommen (`prototyp/UWE Redesign.dc.html`, `pools = {…}`).
 *
 * `src` ist der Pfad **ohne Endung**, relativ zum Szenen-Wurzelverzeichnis; die
 * Endung liefert `SCENE_FILE_EXTENSION`. Bilder in Zielauflösung ersetzen später
 * ausschließlich Dateien — diese Tabelle bleibt unangetastet.
 */

export type SceneArea = "landing" | "studio" | "portal" | "brain";
export type SceneMode = "hell" | "dunkel";
export type SceneVariant = "desktop" | "mobil";

export interface Scene {
  /** Pfad ohne Endung, relativ zum Szenen-Wurzelverzeichnis. */
  src: string;
  /** CSS `background-position` — der kuratierte Crop dieses Motivs. */
  pos: string;
}

/** Einmal zentral, damit ein späterer Formatwechsel eine Konstante ist. */
export const SCENE_FILE_EXTENSION = ".png";

/** Öffentliches Verzeichnis je App (`apps/<app>/public/scenes`). */
export const SCENE_PUBLIC_DIR = "/scenes";

/**
 * Ab hier gilt der Desktop-Pool. Der Wert ist keine Handoff-Angabe (der
 * Prototyp zeigt einen festen 390-px-Rahmen), sondern der im Repo mit Abstand
 * häufigste Breakpoint.
 */
export const SCENE_BREAKPOINT_PX = 960;

type PoolTable = Record<SceneVariant, Record<SceneMode, Record<SceneArea, readonly Scene[]>>>;

const s = (src: string, pos: string): Scene => ({ src, pos });

export const SCENE_POOLS: PoolTable = {
  desktop: {
    hell: {
      landing: [
        s("tag-desktop/10-weltenbaum-stadt", "center 34%"),
        s("tag-desktop/01-alpen-flusstal", "center 35%"),
        s("tag-desktop/08-blumenkueste", "center 42%"),
        s("tag-desktop/04-gruenes-tal-wurzelbruecken", "center 42%"),
      ],
      studio: [
        s("tag-desktop/02-klippenstadt-werften", "center 40%"),
        s("tag-desktop/07-abendlicht-huegel", "center 46%"),
        s("tag-desktop/03-wueste-schwebestaedte", "center 38%"),
      ],
      portal: [
        s("tag-desktop/05-kueste-blattstadt", "center 40%"),
        s("tag-desktop/04-gruenes-tal-wurzelbruecken", "center 42%"),
        s("tag-desktop/01-alpen-flusstal", "center 35%"),
        s("tag-desktop/03-wueste-schwebestaedte", "center 38%"),
      ],
      brain: [
        s("tag-desktop/09-nebelsee-wurzelbaum", "center 45%"),
        s("tag-desktop/06-sumpf-pagodenstadt", "center 42%"),
        s("tag-desktop/07-abendlicht-huegel", "center 46%"),
      ],
    },
    dunkel: {
      landing: [
        s("nacht-desktop/01-weltenbaum-stadt", "center 30%"),
        s("nacht-desktop/10-stadt-blattranken", "center 42%"),
        s("nacht-desktop/07-bergtal-wolkenmeer", "center 42%"),
      ],
      studio: [
        s("nacht-desktop/03-bergstadt-schmieden", "center 40%"),
        s("nacht-desktop/05-felsenstadt-blattranken", "center 38%"),
        s("nacht-desktop/07-bergtal-wolkenmeer", "center 42%"),
      ],
      portal: [
        s("nacht-desktop/08-kueste-wurzeltuerme", "center 40%"),
        s("nacht-desktop/02-wuestenoase-ranken", "center 40%"),
        s("nacht-desktop/06-wueste-riesenwurzeln", "center 38%"),
      ],
      brain: [
        s("nacht-desktop/04-moor-lichtranken", "center 42%"),
        s("nacht-desktop/09-sumpfsee-blattbaum", "center 45%"),
        s("nacht-desktop/06-wueste-riesenwurzeln", "center 38%"),
      ],
    },
  },
  mobil: {
    hell: {
      landing: [
        s("tag-mobil/04-bergtal-turmstadt", "center 45%"),
        s("tag-mobil/01-gassenstadt-ranken", "center 50%"),
        s("tag-mobil/05-meerkueste-blattinsel", "center 45%"),
      ],
      studio: [
        s("tag-mobil/03-schlucht-werkstadt", "center 52%"),
        s("tag-mobil/01-gassenstadt-ranken", "center 50%"),
        s("tag-mobil/04-bergtal-turmstadt", "center 45%"),
      ],
      portal: [
        s("tag-mobil/05-meerkueste-blattinsel", "center 45%"),
        s("tag-mobil/02-wueste-schwebeinsel", "center 42%"),
        s("tag-mobil/04-bergtal-turmstadt", "center 45%"),
      ],
      brain: [
        s("tag-mobil/06-sumpf-nebelturm", "center 45%"),
        s("tag-mobil/02-wueste-schwebeinsel", "center 42%"),
        s("tag-mobil/03-schlucht-werkstadt", "center 52%"),
      ],
    },
    dunkel: {
      landing: [
        s("nacht-mobil/04-bergranke-lichterstadt", "center 45%"),
        s("nacht-mobil/01-gassenstadt-ranken", "center 50%"),
        s("nacht-mobil/05-meerbucht-wurzelinsel", "center 45%"),
      ],
      studio: [
        s("nacht-mobil/02-schlucht-blattturm", "center 48%"),
        s("nacht-mobil/04-bergranke-lichterstadt", "center 45%"),
        s("nacht-mobil/01-gassenstadt-ranken", "center 50%"),
      ],
      portal: [
        s("nacht-mobil/05-meerbucht-wurzelinsel", "center 45%"),
        s("nacht-mobil/03-wuestenoase-leuchtstamm", "center 45%"),
        s("nacht-mobil/04-bergranke-lichterstadt", "center 45%"),
      ],
      brain: [
        s("nacht-mobil/06-sumpfturm-laternen", "center 45%"),
        s("nacht-mobil/03-wuestenoase-leuchtstamm", "center 45%"),
        s("nacht-mobil/02-schlucht-blattturm", "center 48%"),
      ],
    },
  },
};

/** Handout-Vorschau der Portal-Karte — kein Pool, ein festes Motiv. */
export const HANDOUT_PREVIEW: Scene = s("tag-welt-rankenstadt", "center 22%");

export const SCENE_AREAS: readonly SceneArea[] = ["landing", "studio", "portal", "brain"];
export const SCENE_MODES: readonly SceneMode[] = ["hell", "dunkel"];
export const SCENE_VARIANTS: readonly SceneVariant[] = ["desktop", "mobil"];

export function getScenePool(
  area: SceneArea,
  mode: SceneMode,
  variant: SceneVariant,
): readonly Scene[] {
  return SCENE_POOLS[variant][mode][area];
}

/**
 * Alle Dateien, die ein Bereich braucht — beide Modi, beide Viewports.
 * Das Copy-Script kopiert je App nur diese Teilmenge in ihr `public/`.
 */
export function scenesForAreas(areas: readonly SceneArea[]): string[] {
  const files = new Set<string>();
  for (const area of areas) {
    for (const variant of SCENE_VARIANTS) {
      for (const mode of SCENE_MODES) {
        for (const scene of getScenePool(area, mode, variant)) {
          files.add(scene.src + SCENE_FILE_EXTENSION);
        }
      }
    }
  }
  return [...files].sort();
}
