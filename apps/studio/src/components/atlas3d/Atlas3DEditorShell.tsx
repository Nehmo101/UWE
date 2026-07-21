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
import { INK_ASSET_KINDS, INK_ASSET_LABELS, INK_ASSET_DEFAULT_TINT, type InkAssetKind, type InkTint } from "@uwe/atlas-3d/assets-ink";
import {
  createAtlas3DRegionAction,
  saveAtlas3DBookmarksAction,
  saveAtlas3DTerrainAction,
  setAtlas3DEnvironmentAction,
} from "@/app/atlas3d-actions";
import { Atlas3DDescribePanel } from "./Atlas3DDescribePanel";
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
  levelLabel: string;
  mode: Atlas3DEditorMode;
  seed: number;
  initialCarveOps: unknown;
  initialHeightmap: unknown;
  initialSplat: unknown;
  initialObjects: unknown;
  initialFeatures: unknown;
  silhouette: unknown;
  waterLevel: Atlas3DInheritedNumber;
  timeOfDay: Atlas3DInheritedText;
  fogDensity: Atlas3DInheritedNumber;
  bookmarks: { id: string; name: string; pose: unknown }[];
  children3d: Atlas3DChildLink[];
}

const TINTS: { key: InkTint; color: string; label: string }[] = [
  { key: "paper", color: "#f1e8d4", label: "Papier" },
  { key: "sepia", color: "#7a5a3a", label: "Sepia" },
  { key: "terra", color: "#c2622b", label: "Terrakotta" },
  { key: "teal", color: "#2f6f63", label: "Teal" },
  { key: "blue", color: "#35597e", label: "Tintenblau" },
];

const BASE_TOOLS: { id: Atlas3DEditorTool; label: string; hint: string }[] = [
  { id: "orbit", label: "🧭 Orbit", hint: "Ziehen = Drehen · Rad = Zoom" },
  { id: "raise", label: "⛰ Heben", hint: "Klicken/Ziehen hebt das Terrain" },
  { id: "lower", label: "🕳 Senken", hint: "Klicken/Ziehen senkt das Terrain" },
  { id: "smooth", label: "〰 Glätten", hint: "Klicken/Ziehen glättet" },
  { id: "biome", label: "▨ Biom", hint: "Klicken/Ziehen malt das gewählte Biom — stufenlos, kein Raster" },
  { id: "region", label: "▱ Region", hint: "Punkte klicken (mind. 3), dann Ebene anlegen — Drill-Down" },
  { id: "bite", label: "◔ Biss", hint: "Klick beißt ein Stück heraus (Apfel-Prinzip)" },
  { id: "tunnel", label: "◎ Tunnel", hint: "Zwei Klicks bohren einen Tunnel" },
  { id: "asset", label: "♜ Asset", hint: "Klick platziert das gewählte Tusche-Asset" },
  { id: "select", label: "⬚ Auswahl", hint: "Klick wählt aus · Shift erweitert · Entf löscht" },
  { id: "river", label: "↝ Fluss", hint: "Zwei Klicks — der A*-Assistent sucht den Lauf bergab" },
  { id: "road", label: "═ Straße", hint: "Zwei Klicks — der A*-Assistent umgeht Steigungen" },
  { id: "settlement", label: "⌂ Siedlung", hint: "Klick pflanzt einen Weiler — deterministisch, ein Undo-Schritt" },
  { id: "label", label: "A Label", hint: "Text eingeben, dann Klick platziert das Label" },
];

/** Werkzeuge, die flaches Gelände voraussetzen (A*-Routing bzw. Weiler-Layout). */
const TERRAIN_ONLY_TOOLS: ReadonlySet<Atlas3DEditorTool> = new Set(["river", "road", "settlement"]);

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
  const [assetKind, setAssetKind] = useState<InkAssetKind>("tree");
  const [assetTint, setAssetTint] = useState<InkTint>(INK_ASSET_DEFAULT_TINT.tree);
  const [labelDraft, setLabelDraft] = useState("");
  const [selectionCount, setSelectionCount] = useState(0);
  const [splitGap, setSplitGap] = useState(0);
  const [regionPointCount, setRegionPointCount] = useState(0);
  const [regionTitle, setRegionTitle] = useState("");
  const [regionBusy, setRegionBusy] = useState(false);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("gespeichert");
  const [webgl, setWebgl] = useState(true);
  const [describeOpen, setDescribeOpen] = useState(false);
  const [waterDraft, setWaterDraft] = useState(props.waterLevel.value);
  const [fogDraft, setFogDraft] = useState(props.fogDensity.value);
  const [bookmarkName, setBookmarkName] = useState("");

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
        form.set("objects", JSON.stringify(doc.objects));
        form.set("features", JSON.stringify(doc.features));
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
      objects: props.initialObjects,
      features: props.initialFeatures,
      silhouette: props.silhouette,
      waterLevel: props.waterLevel.value,
      environment: { timeOfDay: props.timeOfDay.value, fogDensity: props.fogDensity.value },
      onReady: (info) => setWebgl(info.webgl),
      onRegionDraftChange: (count) => setRegionPointCount(count),
      onSelectionChange: (count) => setSelectionCount(count),
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
                  : kind === "objects"
                    ? "Objekte ändern"
                    : kind === "features"
                      ? "Pfad/Label ändern"
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

  const setEnvironment = (field: "waterLevel" | "timeOfDay" | "fogDensity", value: string) => {
    const form = new FormData();
    form.set("worldSlug", props.worldSlug);
    form.set("nodeId", props.nodeId);
    form.set("field", field);
    form.set("value", value);
    setAtlas3DEnvironmentAction(form).then((result) => {
      if (result.ok) router.refresh();
    });
  };

  const exportPng = () => {
    const dataUrl = appRef.current?.exportImage();
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `atlas3d-${props.nodeTitle.replace(/[^a-z0-9äöüß-]+/gi, "-").toLowerCase()}.png`;
    link.click();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      appRef.current?.deleteSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // rivers/roads/settlements need flat ground; everything else works in both modes
  const tools = props.mode === "globe" ? BASE_TOOLS.filter((t) => !TERRAIN_ONLY_TOOLS.has(t.id)) : BASE_TOOLS;
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
        <button type="button" className="atlas3d-tool" onClick={exportPng} data-testid="atlas3d-export" disabled={!webgl}>
          🖼 PNG
        </button>
        <button type="button" className="atlas3d-tool" onClick={() => setDescribeOpen(true)} data-testid="atlas3d-describe">
          ✦ Beschreiben
        </button>
        <span className="atlas3d-save" data-state={saveState} data-testid="atlas3d-save-state">
          ● {saveState}
        </span>
      </div>

      {tool === "asset" ? (
        <div className="atlas3d-biomes" role="group" aria-label="Asset und Farbe wählen" data-testid="atlas3d-asset-panel">
          {INK_ASSET_KINDS.filter((kind) => kind !== "asteroid" || props.mode === "globe").map((kind) => (
            <button
              key={kind}
              type="button"
              className={assetKind === kind ? "atlas3d-tool on" : "atlas3d-tool"}
              data-testid={`atlas3d-asset-${kind}`}
              aria-pressed={assetKind === kind}
              onClick={() => {
                setAssetKind(kind);
                setAssetTint(INK_ASSET_DEFAULT_TINT[kind]);
                appRef.current?.setAsset({ kind });
              }}
            >
              {INK_ASSET_LABELS[kind]}
            </button>
          ))}
          <span className="atlas3d-spacer" />
          {TINTS.map((tint) => (
            <button
              key={tint.key}
              type="button"
              className={assetTint === tint.key ? "atlas3d-swatch on" : "atlas3d-swatch"}
              style={{ backgroundColor: tint.color }}
              title={tint.label}
              aria-pressed={assetTint === tint.key}
              aria-label={`Farbe ${tint.label}`}
              onClick={() => {
                setAssetTint(tint.key);
                appRef.current?.setAsset({ tint: tint.key });
              }}
            />
          ))}
        </div>
      ) : null}

      {tool === "label" ? (
        <div className="atlas3d-region">
          <input
            type="text"
            placeholder="Label-Text"
            value={labelDraft}
            data-testid="atlas3d-label-text"
            onChange={(event) => {
              setLabelDraft(event.target.value);
              appRef.current?.setLabelText(event.target.value);
            }}
          />
          <span>Dann auf die Karte klicken.</span>
        </div>
      ) : null}

      {tool === "select" && selectionCount > 0 ? (
        <div className="atlas3d-region" data-testid="atlas3d-selection-bar">
          <span>
            {selectionCount} Objekt{selectionCount === 1 ? "" : "e"} ausgewählt
          </span>
          <button type="button" className="atlas3d-tool" onClick={() => appRef.current?.deleteSelection()}>
            🗑 Löschen (Entf)
          </button>
        </div>
      ) : null}

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
          Nebel
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(fogDraft * 100)}
            data-testid="atlas3d-fog"
            onChange={(event) => {
              const density = Number(event.target.value) / 100;
              setFogDraft(density);
              appRef.current?.setEnvironmentVisuals({ fogDensity: density });
            }}
            onPointerUp={() => setEnvironment("fogDensity", String(fogDraft))}
          />
          <em>{fogDraft.toFixed(2)}</em>
          <span className="atlas3d-badge">
            {props.fogDensity.overridden ? (
              <>
                überschrieben ·{" "}
                <button type="button" className="atlas3d-inherit" onClick={() => setEnvironment("fogDensity", "inherit")}>
                  ⤓ wieder erben
                </button>
              </>
            ) : (
              <>⤓ geerbt von {props.fogDensity.fromTitle}</>
            )}
          </span>
        </label>
        <label>
          Tageszeit
          <select
            value={props.timeOfDay.value}
            data-testid="atlas3d-time-select"
            onChange={(event) => {
              appRef.current?.setEnvironmentVisuals({ timeOfDay: event.target.value });
              setEnvironment("timeOfDay", event.target.value);
            }}
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

      <div className="atlas3d-region" data-testid="atlas3d-bookmarks">
        <span>📷 Kamera-Lesezeichen:</span>
        {props.bookmarks.map((bookmark) => (
          <button
            key={bookmark.id}
            type="button"
            className="atlas3d-tool"
            onClick={() => {
              const pose = bookmark.pose as { theta?: number; phi?: number; distance?: number; target?: [number, number, number] };
              appRef.current?.flyTo(pose);
            }}
          >
            {bookmark.name}
          </button>
        ))}
        <input
          type="text"
          placeholder="Name"
          value={bookmarkName}
          data-testid="atlas3d-bookmark-name"
          onChange={(event) => setBookmarkName(event.target.value)}
        />
        <button
          type="button"
          className="atlas3d-tool"
          data-testid="atlas3d-bookmark-add"
          disabled={bookmarkName.trim().length === 0}
          onClick={() => {
            const pose = appRef.current?.getCameraPose();
            if (!pose) return;
            const form = new FormData();
            form.set("worldSlug", props.worldSlug);
            form.set("nodeId", props.nodeId);
            form.set(
              "bookmarks",
              JSON.stringify([...props.bookmarks.map((b) => ({ name: b.name, pose: b.pose })), { name: bookmarkName.trim(), pose }]),
            );
            saveAtlas3DBookmarksAction(form).then((result) => {
              if (result.ok) {
                setBookmarkName("");
                router.refresh();
              }
            });
          }}
        >
          + Blick merken
        </button>
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

      {describeOpen ? (
        <Atlas3DDescribePanel
          worldSlug={props.worldSlug}
          nodeTitle={props.nodeTitle}
          levelLabel={props.levelLabel}
          onClose={() => setDescribeOpen(false)}
        />
      ) : null}
    </div>
  );
}
