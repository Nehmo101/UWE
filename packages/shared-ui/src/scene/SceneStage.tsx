"use client";

import { useRef } from "react";
import type { SceneArea } from "./scenePools";
import { hasSceneMotion, sceneMotionBase } from "./sceneMotion";
import { useSceneMotion } from "./useSceneMotion";

/**
 * Die bewegte Ebene der Bühne.
 *
 * Sie ersetzt `PaintedScene` nicht, sondern legt sich darüber. Das ist der
 * ganze Trick: die gemalte Standbild-Bühne ist bereits im ersten
 * server-gerenderten Frame vollständig da — mit Verlauf, Veil und Boden. Das
 * Video blendet sich erst ein, wenn es wirklich dekodiert ist, und verschwindet
 * wieder, sobald es nicht laufen darf. Es gibt deshalb:
 *
 *   - keinen Layout-Shift (die Ebene ist `position: absolute; inset: 0`),
 *   - keinen weißen oder schwarzen Blitz (das Poster ist das Standbild darunter),
 *   - keinen Fehlerfall ohne Datei (`available: false` rendert gar kein <video>).
 *
 * Genau **ein** Clip ist gleichzeitig geladen. Tag/Nacht und Desktop/Mobil
 * tauschen die Quelle desselben Elements, statt vier Elemente vorzuhalten.
 *
 * Styling: packages/shared-ui/src/design-v3/scene-stage.css
 */

export interface SceneStageProps {
  area: SceneArea;
  /** Präfix für die Datei-URLs — das Portal kann unter einem Unterpfad laufen. */
  basePath?: string;
  /** Vollbild oder Band (Studio zeigt nur das obere Drittel). */
  height?: "full" | "band";
}

export function SceneStage({ area, basePath = "", height = "full" }: SceneStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const motion = useSceneMotion(area, hostRef, videoRef);

  // Kein einziger Clip für diesen Bereich hinterlegt? Dann gibt es hier nichts
  // zu tun — kein Element, kein Observer, kein Byte.
  if (!hasSceneMotion(area)) return null;

  const base = sceneMotionBase(area, motion.mode, motion.variant, basePath);

  return (
    <div
      ref={hostRef}
      className="uwe-scene-stage"
      data-height={height}
      data-ready={motion.ready ? "true" : "false"}
      aria-hidden="true"
    >
      {motion.active ? (
        <video
          ref={videoRef}
          className="uwe-scene-stage__video"
          style={{ objectPosition: motion.objectPosition }}
          // Ton gibt es nicht und soll es nicht geben — `muted` ist außerdem
          // die Bedingung dafür, dass Browser Autoplay überhaupt erlauben.
          muted
          loop
          playsInline
          // `preload="none"`: der erste Seitenaufruf lädt kein Videobyte. Erst
          // wenn die Bühne im Viewport ist, startet `play()` den Abruf.
          preload="none"
          // Das Poster ist dasselbe Bild wie der erste Frame — der Übergang
          // vom Standbild ins Video ist deshalb unsichtbar.
          poster={`${base}.webp`}
          onCanPlay={motion.markReady}
          disablePictureInPicture
          tabIndex={-1}
        >
          {/* WebM zuerst: der Browser nimmt die erste Quelle, die er kann. */}
          <source src={`${base}.webm`} type="video/webm" />
          <source src={`${base}.mp4`} type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}
