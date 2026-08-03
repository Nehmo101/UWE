import { PaintedScene } from "@uwe/shared-ui";

/**
 * Die gemalte Bühne im Studio — als Band, nicht als Vollbild.
 *
 * Studio unterscheidet sich hier bewusst von Portal, Brain und Family: dort
 * trägt ein `SceneHero` Titel und Subline auf dem Bild. Im Studio bringt jede
 * Seite ihren eigenen Kopf mit (`PageHeader`), und der Shell weiß von dessen
 * Inhalt nichts. Ein zweiter Titel auf der Szene wäre eine Dopplung, ein
 * dritter Kopfbereich zusätzlich zu Brotkrumen und Seiten-Header schlicht zu
 * viel. Das Band ist deshalb reine Kulisse: es liegt hinter dem oberen Rand
 * der Arbeitsfläche und läuft im Boden-Verlauf in die Grundfarbe aus.
 *
 * `groundEnd="100%"` ist der Grund, warum es keine Kante gibt: der Verlauf
 * erreicht `--uwe-bg` genau dort, wo das Band endet. Bei einem kleineren Wert
 * bliebe eine sichtbare Abrisskante mitten im Bild stehen.
 *
 * Styling: apps/studio/app/globals.css (`.studio-scene-band`).
 */
export function StudioSceneBand({ sceneIndex }: { sceneIndex: number }) {
  return (
    <div className="studio-scene-band" aria-hidden>
      <PaintedScene
        area="studio"
        sceneIndex={sceneIndex}
        // `bandHeight="100%"`: die Höhe bestimmt der Wrapper, nicht die
        // Standard-62-%-Regel aus painted-scene.css — die bezieht sich auf
        // einen Vollbild-Container, den es hier nicht gibt.
        height="band"
        bandHeight="100%"
        veil="band"
        groundStart="30%"
        groundEnd="100%"
      />
    </div>
  );
}
