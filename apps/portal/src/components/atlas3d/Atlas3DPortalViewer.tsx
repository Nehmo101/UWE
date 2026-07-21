"use client";

import { useEffect, useRef, useState } from "react";
import { createAtlas3DEditorApp, type Atlas3DEditorApp } from "@uwe/atlas-3d/editor-app";

export interface Atlas3DPortalViewerProps {
  nodeTitle: string;
  mode: "globe" | "terrain";
  seed: number;
  carveOps: unknown;
  heightmap: unknown;
  splat: unknown;
  objects: unknown;
  features: unknown;
  silhouette: unknown;
  waterLevel: number;
  environment: { timeOfDay?: string; fogDensity?: number };
  bookmarks: { id: string; name: string; pose: unknown }[];
}

/**
 * Read-only player view of an Atlas 3D level: the same living scene as the
 * Studio editor (idle animations included), orbit/pan/zoom only — no tools,
 * no commits. Atlas 3D content is entirely player-visible by owner decision.
 */
export function Atlas3DPortalViewer(props: Atlas3DPortalViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<Atlas3DEditorApp | null>(null);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const app = createAtlas3DEditorApp(canvas, {
      mode: props.mode,
      seed: props.seed,
      carveOps: props.carveOps,
      heightmap: props.heightmap,
      splat: props.splat,
      objects: props.objects,
      features: props.features,
      silhouette: props.silhouette,
      waterLevel: props.waterLevel,
      environment: props.environment,
      readOnly: true,
      onReady: (info) => setWebgl(info.webgl),
    });
    appRef.current = app;
    return () => {
      app.dispose();
      appRef.current = null;
    };
    // one viewer per node mount; server data is stable per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="atlas3d-portal-viewer" data-testid="atlas3d-portal-viewer">
      <div className="atlas3d-portal-canvas">
        <canvas ref={canvasRef} data-testid="atlas3d-portal-canvas" aria-label={`3D-Karte: ${props.nodeTitle}`} />
        {!webgl ? <div className="atlas3d-portal-nogl">Die 3D-Karte benötigt WebGL.</div> : null}
        <div className="atlas3d-portal-hint">
          {props.mode === "terrain" ? "Ziehen = Verschieben · Shift = Neigen · Rad = Zoom" : "Ziehen = Drehen · Rad = Zoom"}
        </div>
      </div>
      {props.bookmarks.length > 0 ? (
        <div className="atlas3d-portal-bookmarks">
          <span>Aussichtspunkte:</span>
          {props.bookmarks.map((bookmark) => (
            <button
              key={bookmark.id}
              type="button"
              onClick={() => {
                const pose = bookmark.pose as { theta?: number; phi?: number; distance?: number; target?: [number, number, number] };
                appRef.current?.flyTo(pose);
              }}
            >
              {bookmark.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
