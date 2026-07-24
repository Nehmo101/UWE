import type { ReactNode } from "react";
import { PaintedScene, type SceneVeil } from "./PaintedScene";
import type { SceneArea } from "./scenePools";

/**
 * Kopfbereich über der gemalten Szene: „Landschaft oben, Arbeit unten".
 *
 * Portal, Brain und Studio teilen dasselbe Muster — Szene füllt den Bereich,
 * Eyebrow/Titel/Subline sitzen am unteren Bildrand auf dem Verlauf zum Grund,
 * der bestehende Seiteninhalt fließt darunter weiter. Genau deshalb ersetzt der
 * Hero keinen Inhalt: er ist die Bühne davor.
 *
 * Styling: design-v2/painted-scene.css
 */

export interface SceneHeroProps {
  area: SceneArea;
  sceneIndex: number;
  /** Kleine Versalzeile über dem Titel. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Subline unter dem Titel. */
  lede?: ReactNode;
  /** Rechtsbündige Aktionen neben dem Titel (Studio: „+ Erfassen"). */
  actions?: ReactNode;
  /** Titelgröße laut Handoff: Portal 56px, Brain 52px, Studio 44px. */
  size?: "portal" | "brain" | "studio";
  veil?: SceneVeil;
  groundStart?: string;
  groundEnd?: string;
  /** Präfix für Bild-URLs (Portal-Unterpfad-Deployment). */
  basePath?: string;
  /** Inhalt, der noch über dem Bodenverlauf sitzen soll (Session-Leiste o. Ä.). */
  children?: ReactNode;
}

export function SceneHero({
  area,
  sceneIndex,
  eyebrow,
  title,
  lede,
  actions,
  size = "portal",
  veil = "default",
  groundStart = "34%",
  groundEnd = "84%",
  basePath = "",
  children,
}: SceneHeroProps) {
  return (
    <section className="uwe-scene-hero-block" data-size={size}>
      <PaintedScene
        area={area}
        sceneIndex={sceneIndex}
        veil={veil}
        groundStart={groundStart}
        groundEnd={groundEnd}
        basePath={basePath}
      />
      <div className="uwe-scene-content uwe-scene-hero-inner">
        <div className="uwe-scene-hero-head">
          <div>
            {eyebrow ? <div className="uwe-scene-hero-eyebrow">{eyebrow}</div> : null}
            <h1 className="uwe-scene-hero-title uwe-scene-hero">{title}</h1>
            {lede ? <p className="uwe-scene-hero-lede uwe-scene-hero-sub">{lede}</p> : null}
          </div>
          {actions ? <div className="uwe-scene-hero-actions">{actions}</div> : null}
        </div>
        {children}
      </div>
    </section>
  );
}
