"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Atlas3DCommandStack } from "@uwe/atlas-editor/commands";
import {
  createAtlas3DEditorApp,
  type Atlas3DEditorApp,
  type Atlas3DEditorDocState,
  type Atlas3DEditorTool,
} from "@uwe/atlas-3d/editor-app";
import { saveAtlas3DTerrainAction } from "@/app/atlas3d-actions";
import "./atlas3d.css";

export interface Atlas3DEditorShellProps {
  worldSlug: string;
  nodeId: string;
  nodeTitle: string;
  seed: number;
  initialCarveOps: unknown;
  initialHeightmap: unknown;
}

const TOOLS: { id: Atlas3DEditorTool; label: string; hint: string }[] = [
  { id: "orbit", label: "🧭 Orbit", hint: "Ziehen = Drehen · Rad = Zoom" },
  { id: "raise", label: "⛰ Heben", hint: "Klicken/Ziehen hebt das Terrain" },
  { id: "lower", label: "🕳 Senken", hint: "Klicken/Ziehen senkt das Terrain" },
  { id: "smooth", label: "〰 Glätten", hint: "Klicken/Ziehen glättet" },
  { id: "bite", label: "◔ Biss", hint: "Klick beißt ein Stück heraus (Apfel-Prinzip)" },
  { id: "tunnel", label: "◎ Tunnel", hint: "Zwei Klicks bohren einen Tunnel" },
];

type SaveState = "gespeichert" | "ungespeichert" | "speichert …" | "Fehler";

export function Atlas3DEditorShell(props: Atlas3DEditorShellProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<Atlas3DEditorApp | null>(null);
  const lastDocRef = useRef<Atlas3DEditorDocState | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tool, setTool] = useState<Atlas3DEditorTool>("orbit");
  const [brushRadius, setBrushRadius] = useState(0.28);
  const [splitGap, setSplitGap] = useState(0);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("gespeichert");
  const [webgl, setWebgl] = useState(true);

  const stack = useMemo(
    () =>
      new Atlas3DCommandStack({
        onChange: (s) => {
          setUndoDepth(s.undoDepth);
          setRedoDepth(s.redoDepth);
        },
      }),
    [],
  );

  const scheduleSave = useCallback(
    (doc: Atlas3DEditorDocState) => {
      setSaveState("ungespeichert");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setSaveState("speichert …");
        const form = new FormData();
        form.set("worldSlug", props.worldSlug);
        form.set("nodeId", props.nodeId);
        form.set("carveOps", JSON.stringify(doc.carveOps));
        form.set("heightmap", JSON.stringify(doc.heightmap));
        saveAtlas3DTerrainAction(form)
          .then((result) => setSaveState(result.ok ? "gespeichert" : "Fehler"))
          .catch(() => setSaveState("Fehler"));
      }, 1200);
    },
    [props.worldSlug, props.nodeId],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const app = createAtlas3DEditorApp(canvas, {
      seed: props.seed,
      carveOps: props.initialCarveOps,
      heightmap: props.initialHeightmap,
      onReady: (info) => setWebgl(info.webgl),
      onCommit: (kind, nextDoc) => {
        const prevDoc = lastDocRef.current;
        lastDocRef.current = nextDoc;
        stack.execute({
          label:
            kind === "sculpt" ? "Terrain formen" : kind === "split" ? "Welt teilen" : "Herausschneiden",
          coalesceKey: kind === "split" ? "split" : undefined,
          apply: () => {
            appRef.current?.applyExternal(nextDoc);
            lastDocRef.current = nextDoc;
            setSplitGap(nextDoc.splitGap);
            scheduleSave(nextDoc);
          },
          revert: () => {
            if (!prevDoc) return;
            appRef.current?.applyExternal(prevDoc);
            lastDocRef.current = prevDoc;
            setSplitGap(prevDoc.splitGap);
            scheduleSave(prevDoc);
          },
        });
      },
    });
    appRef.current = app;
    lastDocRef.current = app.getDocSnapshot();
    setSplitGap(lastDocRef.current.splitGap);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      app.dispose();
      appRef.current = null;
    };
    // The editor app is created exactly once per node; props feeding it are stable per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.nodeId]);

  const selectTool = (next: Atlas3DEditorTool) => {
    setTool(next);
    appRef.current?.setTool(next);
  };

  const activeHint = TOOLS.find((t) => t.id === tool)?.hint ?? "";

  return (
    <div className="atlas3d-editor" data-testid="atlas3d-editor">
      <div className="atlas3d-toolbar" role="toolbar" aria-label="Atlas-3D-Werkzeuge">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`atlas3d-tool-${t.id}`}
            aria-pressed={tool === t.id}
            className={tool === t.id ? "atlas3d-tool on" : "atlas3d-tool"}
            onClick={() => selectTool(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className="atlas3d-spacer" />
        <button
          type="button"
          className="atlas3d-tool"
          disabled={undoDepth === 0}
          onClick={() => stack.undo()}
          data-testid="atlas3d-undo"
        >
          ↩ Rückgängig ({undoDepth})
        </button>
        <button
          type="button"
          className="atlas3d-tool"
          disabled={redoDepth === 0}
          onClick={() => stack.redo()}
        >
          ↪ Wiederholen
        </button>
        <span className="atlas3d-save" data-state={saveState} data-testid="atlas3d-save-state">
          ● {saveState}
        </span>
      </div>

      <div className="atlas3d-viewport">
        <canvas ref={canvasRef} data-testid="atlas3d-canvas" aria-label={`3D-Ansicht: ${props.nodeTitle}`} />
        {!webgl ? (
          <div className="atlas3d-nogl">3D-Vorschau benötigt WebGL — Werkzeuge und Speichern funktionieren trotzdem.</div>
        ) : null}
        <div className="atlas3d-hint">{activeHint}</div>
      </div>

      <div className="atlas3d-inspector">
        <label>
          Pinselgröße
          <input
            type="range"
            min={5}
            max={80}
            value={Math.round(brushRadius * 100)}
            onChange={(event) => {
              const radius = Number(event.target.value) / 100;
              setBrushRadius(radius);
              appRef.current?.setBrush({ radius });
            }}
          />
        </label>
        <label>
          Spaltbreite (Welt teilen)
          <input
            type="range"
            min={0}
            max={60}
            value={Math.round(splitGap * 100)}
            data-testid="atlas3d-split-gap"
            onChange={(event) => {
              const gap = Number(event.target.value) / 100;
              setSplitGap(gap);
              appRef.current?.setSplitGap(gap);
            }}
            onPointerUp={() => appRef.current?.commitSplit()}
            onKeyUp={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") appRef.current?.commitSplit();
            }}
          />
          <em>{splitGap.toFixed(2)}</em>
        </label>
      </div>
    </div>
  );
}
