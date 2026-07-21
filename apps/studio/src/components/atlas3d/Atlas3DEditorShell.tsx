"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Atlas3DCommandStack } from "@uwe/atlas-editor/commands";
import {
  createAtlas3DEditorApp,
  type Atlas3DEditorApp,
  type Atlas3DEditorDocState,
  type Atlas3DEditorMode,
  type Atlas3DEditorTool,
} from "@uwe/atlas-3d/editor-app";
import { ATLAS3D_BIOMES } from "@uwe/atlas-3d/splat";
import {
  createAtlas3DRegionAction,
  saveAtlas3DTerrainAction,
  setAtlas3DEnvironmentAction,
} from "@/app/atlas3d-actions";
import "./atlas3d.css";

export interface Atlas3DInheritedNumber {
  value: number;
  fromTitle: string;
  overridden: boolean;
}

export interface Atlas3DInheritedText {
  value: string;
  fromTitle: string;
  overridden: boolean;
}

export interface Atlas3DChildLink {
  id: string;
  title: string;
  levelLabel: string;
}

export interface Atlas3DEditorShellProps {
  worldSlug: string;
  nodeId: string;
  nodeTitle: string;
  mode: Atlas3DEditorMode;
  seed: number;
  initialCarveOps: unknown;
  initialHeightmap: unknown;
  initialSplat: unknown;
  silhouette: unknown;
  waterLevel: Atlas3DInheritedNumber;
  timeOfDay: Atlas3DInheritedText;
  children3d: Atlas3DChildLink[];
}

const BASE_TOOLS: { id: Atlas3DEditorTool; label: string; hint: string }[] = [
  { id: "orbit", label: "🧭 Orbit", hint: "Ziehen = Drehen · Rad = Zoom" },
  { id: "raise", label: "⛰ Heben", hint: "Klicken/Ziehen hebt das Terrain" },
  { id: "lower", label: "🕳 Senken", hint: "Klicken/Ziehen senkt das Terrain" },
  { id: "smooth", label: "〰 Glätten", hint: "Klicken/Ziehen glättet" },
  { id: "biome", label: "▨ Biom", hint: "Klicken/Ziehen malt das gewählte Biom — stufenlos, kein Raster" },
  { id: "region", label: "▱ Region", hint: "Punkte klicken (mind. 3), dann Ebene anlegen — Drill-Down" },
  { id: "bite", label: "◔ Biss", hint: "Klick beißt ein Stück heraus (Apfel-Prinzip)" },
  { id: "tunnel", label: "◎ Tunnel", hint: "Zwei Klicks bohren einen Tunnel" },
];

const TIME_OPTIONS = [
  { value: "morning", label: "Morgen" },
  { value: "noon", label: "Mittag" },
  { value: "evening", label: "Abend" },
  { value: "night", label: "Nacht" },
];

type SaveState = "gespeichert" | "ungespeichert" | "speichert …" | "Fehler";

export function Atlas3DEditorShell(props: Atlas3DEditorShellProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<Atlas3DEditorApp | null>(null);
  const lastDocRef = useRef<Atlas3DEditorDocState | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tool, setTool] = useState<Atlas3DEditorTool>("orbit");
  const [brushRadius, setBrushRadius] = useState(0.28);
  const [activeBiome, setActiveBiome] = useState(1);
  const [splitGap, setSplitGap] = useState(0);
  const [regionPointCount, setRegionPointCount] = useState(0);
  const [regionTitle, setRegionTitle] = useState("");
  const [regionBusy, setRegionBusy] = useState(false);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("gespeichert");
  const [webgl, setWebgl] = useState(true);
  const [waterDraft, setWaterDraft] = useState(props.waterLevel.value);

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
        form.set("splat", JSON.stringify(doc.splat));
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
      mode: props.mode,
      seed: props.seed,
      carveOps: props.initialCarveOps,
      heightmap: props.initialHeightmap,
      splat: props.initialSplat,
      silhouette: props.silhouette,
      waterLevel: props.waterLevel.value,
      onReady: (info) => setWebgl(info.webgl),
      onRegionDraftChange: (count) => setRegionPointCount(count),
      onCommit: (kind, nextDoc) => {
        const prevDoc = lastDocRef.current;
        lastDocRef.current = nextDoc;
        stack.execute({
          label:
            kind === "sculpt"
              ? "Terrain formen"
              : kind === "split"
                ? "Welt teilen"
                : kind === "biome"
                  ? "Biom malen"
                  : "Herausschneiden",
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
    setRegionError(null);
    appRef.current?.setTool(next);
  };

  const createRegion = () => {
    const draft = appRef.current?.getRegionDraft();
    if (!draft) return;
    setRegionBusy(true);
    setRegionError(null);
    const form = new FormData();
    form.set("worldSlug", props.worldSlug);
    form.set("parentNodeId", props.nodeId);
    form.set("title", regionTitle);
    form.set("mode", draft.mode);
    form.set("points", JSON.stringify(draft.points));
    createAtlas3DRegionAction(form)
      .then((result) => {
        if (result.ok && result.childId) {
          appRef.current?.clearRegionDraft();
          router.push(`/worlds/${props.worldSlug}/atlas3d/${result.childId}`);
        } else {
          setRegionError(result.error ?? "Ebene anlegen fehlgeschlagen");
        }
      })
      .catch(() => setRegionError("Ebene anlegen fehlgeschlagen"))
      .finally(() => setRegionBusy(false));
  };

  const setEnvironment = (field: "waterLevel" | "timeOfDay", value: string) => {
    const form = new FormData();
    form.set("worldSlug", props.worldSlug);
    form.set("nodeId", props.nodeId);
    form.set("field", field);
    form.set("value", value);
    setAtlas3DEnvironmentAction(form).then((result) => {
      if (result.ok) router.refresh();
    });
  };

  const tools = BASE_TOOLS;
  const activeHint = BASE_TOOLS.find((t) => t.id === tool)?.hint ?? "";

  return (
    <div className="atlas3d-editor" data-testid="atlas3d-editor" data-mode={props.mode}>
      <div className="atlas3d-toolbar" role="toolbar" aria-label="Atlas-3D-Werkzeuge">
        {tools.map((t) => (
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
        <button type="button" className="atlas3d-tool" disabled={redoDepth === 0} onClick={() => stack.redo()}>
          ↪ Wiederholen
        </button>
        <span className="atlas3d-save" data-state={saveState} data-testid="atlas3d-save-state">
          ● {saveState}
        </span>
      </div>

      {tool === "biome" ? (
        <div className="atlas3d-biomes" role="group" aria-label="Biom wählen">
          {ATLAS3D_BIOMES.map((biome, index) => (
            <button
              key={biome.key}
              type="button"
              className={activeBiome === index + 1 ? "atlas3d-biome on" : "atlas3d-biome"}
              style={{ backgroundColor: biome.color }}
              title={biome.label}
              aria-pressed={activeBiome === index + 1}
              onClick={() => {
                setActiveBiome(index + 1);
                appRef.current?.setBiome(index + 1);
              }}
            >
              <span>{biome.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {tool === "region" ? (
        <div className="atlas3d-region" data-testid="atlas3d-region-panel">
          <span>
            Region: {regionPointCount} Punkt{regionPointCount === 1 ? "" : "e"} gesetzt
            {regionPointCount < 3 ? " (mindestens 3)" : ""}
          </span>
          <input
            type="text"
            placeholder="Name der neuen Ebene"
            value={regionTitle}
            data-testid="atlas3d-region-title"
            onChange={(event) => setRegionTitle(event.target.value)}
          />
          <button
            type="button"
            className="atlas3d-tool"
            data-testid="atlas3d-region-create"
            disabled={regionPointCount < 3 || regionTitle.trim().length === 0 || regionBusy}
            onClick={createRegion}
          >
            ⤵ Ebene anlegen (Drill-Down)
          </button>
          {regionError ? <em className="atlas3d-error">{regionError}</em> : null}
        </div>
      ) : null}

      <div className="atlas3d-viewport">
        <canvas ref={canvasRef} data-testid="atlas3d-canvas" aria-label={`3D-Ansicht: ${props.nodeTitle}`} />
        {!webgl ? (
          <div className="atlas3d-nogl">3D-Vorschau benötigt WebGL — Werkzeuge und Speichern funktionieren trotzdem.</div>
        ) : null}
        <div className="atlas3d-hint">
          {props.mode === "terrain" ? "Top-Down 3D · Ziehen = Verschieben · Shift = Neigen · " : ""}
          {activeHint}
        </div>
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
        {props.mode === "globe" ? (
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
        ) : (
          <label>
            Wasserstand
            <input
              type="range"
              min={-60}
              max={60}
              value={Math.round(waterDraft * 100)}
              data-testid="atlas3d-water-level"
              onChange={(event) => {
                const level = Number(event.target.value) / 100;
                setWaterDraft(level);
                appRef.current?.setWaterLevel(level);
              }}
              onPointerUp={() => setEnvironment("waterLevel", String(waterDraft))}
            />
            <em>{waterDraft.toFixed(2)}</em>
            <span className="atlas3d-badge" data-testid="atlas3d-water-badge">
              {props.waterLevel.overridden ? (
                <>
                  überschrieben ·{" "}
                  <button type="button" className="atlas3d-inherit" onClick={() => setEnvironment("waterLevel", "inherit")}>
                    ⤓ wieder erben
                  </button>
                </>
              ) : (
                <>⤓ geerbt von {props.waterLevel.fromTitle}</>
              )}
            </span>
          </label>
        )}
        <label>
          Tageszeit
          <select
            value={props.timeOfDay.value}
            data-testid="atlas3d-time-select"
            onChange={(event) => setEnvironment("timeOfDay", event.target.value)}
          >
            {TIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="atlas3d-badge">
            {props.timeOfDay.overridden ? (
              <>
                überschrieben ·{" "}
                <button type="button" className="atlas3d-inherit" onClick={() => setEnvironment("timeOfDay", "inherit")}>
                  ⤓ wieder erben
                </button>
              </>
            ) : (
              <>⤓ geerbt von {props.timeOfDay.fromTitle}</>
            )}
          </span>
        </label>
      </div>

      {props.children3d.length > 0 ? (
        <div className="atlas3d-children" data-testid="atlas3d-children">
          <span>Unter-Ebenen:</span>
          {props.children3d.map((child) => (
            <Link key={child.id} href={`/worlds/${props.worldSlug}/atlas3d/${child.id}`} className="atlas3d-child">
              {child.title} <em>{child.levelLabel}</em>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
