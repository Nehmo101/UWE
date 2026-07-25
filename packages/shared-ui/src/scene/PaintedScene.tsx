import type { CSSProperties, ReactNode } from "react";
import { resolveScenePair, sceneCssUrl, sceneUrl } from "./pickScene";
import { SCENE_BREAKPOINT_PX, type SceneArea } from "./scenePools";

/**
 * Die gemalte Bühne hinter einem Screen.
 *
 * Bewusst **keine** Client-Komponente und ohne jeden Hook: der Szenen-Index ist
 * eine reine Funktion des Datums und wird serverseitig berechnet. Alles, was die
 * Komponente tut, ist zwei Bild-URLs als Custom-Property zu setzen; Hell/Dunkel
 * und Desktop/Mobil entscheiden Theme-Attribut und Media-Query in CSS.
 * Deshalb gibt es weder Hydration-Mismatch noch einen Nachlade-Blitz.
 *
 * Styling: packages/shared-ui/src/design-v2/painted-scene.css
 */

export type SceneVeil = "default" | "portal" | "soft" | "band";

export interface PaintedSceneProps {
  /** Welcher Pool — bestimmt die Motivauswahl. */
  area: SceneArea;
  /** Tagesindex, serverseitig aus `dayIndex()` berechnet. */
  sceneIndex: number;
  /** Vollbild oder Band (Studio: oberes Drittel). */
  height?: "full" | "band";
  /** Höhe des Bandes, wenn `height="band"`. */
  bandHeight?: string;
  /** Abdunkel-Verlauf im Dunkelmodus — Varianten aus dem Handoff. */
  veil?: SceneVeil;
  /** Oberer Verlauf, damit Nav/Topbar über dem Bild tragen. */
  topShade?: boolean;
  /** Wo der Boden-Verlauf einsetzt bzw. den Grund erreicht (CSS-Prozente). */
  groundStart?: string;
  groundEnd?: string;
  /** Präfix für die Bild-URLs — das Portal kann unter einem Unterpfad laufen. */
  basePath?: string;
  /**
   * Preload-Links für **beide** Ebenen des Tages. Ohne sie lädt der
   * Hell/Dunkel-Crossfade das Nachtbild erst beim Umschalten nach. Nur diese
   * zwei — nicht der ganze Pool.
   */
  preload?: boolean;
}

export function PaintedScene({
  area,
  sceneIndex,
  height = "full",
  bandHeight,
  veil = "default",
  topShade = false,
  groundStart = "42%",
  groundEnd = "96%",
  basePath = "",
  preload = true,
}: PaintedSceneProps) {
  const desktop = resolveScenePair(area, "desktop", sceneIndex);
  const mobil = resolveScenePair(area, "mobil", sceneIndex);

  const style: CSSProperties = {
    ["--uwe-scene-day-desktop" as string]: sceneCssUrl(desktop.day, basePath),
    ["--uwe-scene-day-pos-desktop" as string]: desktop.day.pos,
    ["--uwe-scene-night-desktop" as string]: sceneCssUrl(desktop.night, basePath),
    ["--uwe-scene-night-pos-desktop" as string]: desktop.night.pos,
    ["--uwe-scene-day-mobil" as string]: sceneCssUrl(mobil.day, basePath),
    ["--uwe-scene-day-pos-mobil" as string]: mobil.day.pos,
    ["--uwe-scene-night-mobil" as string]: sceneCssUrl(mobil.night, basePath),
    ["--uwe-scene-night-pos-mobil" as string]: mobil.night.pos,
    ["--uwe-scene-ground-start" as string]: groundStart,
    ["--uwe-scene-ground-end" as string]: groundEnd,
    ...(bandHeight ? { ["--uwe-scene-band-height" as string]: bandHeight } : {}),
  };

  const desktopMedia = `(min-width: ${SCENE_BREAKPOINT_PX}px)`;
  const mobilMedia = `(max-width: ${SCENE_BREAKPOINT_PX - 1}px)`;

  return (
    <>
      {preload ? (
        <ScenePreload
          basePath={basePath}
          entries={[
            [desktop.day, desktopMedia],
            [desktop.night, desktopMedia],
            [mobil.day, mobilMedia],
            [mobil.night, mobilMedia],
          ]}
        />
      ) : null}
      <div className="uwe-scene" data-height={height} aria-hidden="true" style={style}>
        <div className="uwe-scene__layer uwe-scene__day" />
        <div className="uwe-scene__layer uwe-scene__night" />
        <div className="uwe-scene__veil" data-veil={veil} />
        {topShade ? <div className="uwe-scene__top-shade" /> : null}
        <div className="uwe-scene__ground" />
      </div>
    </>
  );
}

function ScenePreload({
  entries,
  basePath,
}: {
  entries: [{ src: string; pos: string }, string][];
  basePath: string;
}) {
  return (
    <>
      {entries.map(([scene, media]) => (
        <link
          key={`${scene.src}-${media}`}
          rel="preload"
          as="image"
          media={media}
          href={sceneUrl(scene, basePath)}
        />
      ))}
    </>
  );
}

/** Wrapper für den Inhalt, der über der Szene sitzt. */
export function SceneContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className ? `uwe-scene-content ${className}` : "uwe-scene-content"}>
      {children}
    </div>
  );
}
