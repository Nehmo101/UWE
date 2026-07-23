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
  GLOBE_ONLY_ASSET_KINDS,
  INK_ASSET_GROUPS,
  INK_ASSET_LABELS,
  INK_ASSET_DEFAULT_TINT,
  type InkAssetKind,
  type InkTint,
} from "@uwe/atlas-3d/assets-ink";
import { summarizeCarveOps, type CarveOpSummary } from "@uwe/atlas-3d/carve-tools";
import { TERRAIN_STAMPS, type TerrainStampKind } from "@uwe/atlas-3d/stamps";
import {
  createAtlas3DRegionAction,
  saveAtlas3DTerrainAction,
  setAtlas3DEnvironmentAction,
} from "@/app/atlas3d-actions";
import { Atlas3DDescribePanel } from "./Atlas3DDescribePanel";
import {
  Atlas3DInspectorPanel,
  type Atlas3DInheritedNumber,
  type Atlas3DInheritedText,
} from "./Atlas3DInspectorPanel";
import { Atlas3DBookmarksBar } from "./Atlas3DBookmarksBar";
import { Atlas3DLevelTree, type Atlas3DRegionFeatureItem, type Atlas3DTreeNode } from "./Atlas3DLevelTree";
import "./atlas3d.css";

export type { Atlas3DInheritedNumber, Atlas3DInheritedText } from "./Atlas3DInspectorPanel";

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
  weather: Atlas3DInheritedText;
  bookmarks: { id: string; name: string; pose: unknown }[];
  children3d: Atlas3DChildLink[];
  /** All nodes of the atlas world (level-tree navigation). */
  treeNodes: Atlas3DTreeNode[];
  /** Region markers of THIS node. */
  regionFeatures: Atlas3DRegionFeatureItem[];
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
  { id: "flatten", label: "▭ Plateau", hint: "Klicken/Ziehen zieht das Terrain zur Grundhöhe — ebene Flächen" },
  { id: "stamp", label: "⌾ Stempel", hint: "Klick prägt das gewählte Profil: Krater · Gebirge · Dünen" },
  { id: "biome", label: "▨ Biom", hint: "Klicken/Ziehen malt das gewählte Biom — stufenlos, kein Raster" },
  { id: "region", label: "▱ Region", hint: "Punkte klicken (mind. 3), dann Ebene anlegen — Drill-Down" },
  { id: "bite", label: "◔ Biss", hint: "Klick beißt ein Stück heraus (Apfel-Prinzip)" },
  { id: "tunnel", label: "◎ Tunnel", hint: "Zwei Klicks bohren einen Tunnel" },
  { id: "asset", label: "♜ Asset", hint: "Klick platziert das gewählte Tusche-Asset" },
  { id: "scatter", label: "❋ Streuen", hint: "Klick pflanzt einen Cluster des gewählten Assets — mit Auto-Variation" },
  { id: "select", label: "⬚ Auswahl", hint: "Klick wählt aus · Shift erweitert · Entf löscht" },
  { id: "river", label: "↝ Fluss", hint: "Zwei Klicks — der A*-Assistent sucht den Lauf bergab" },
  { id: "road", label: "═ Straße", hint: "Zwei Klicks — der A*-Assistent umgeht Steigungen" },
  { id: "settlement", label: "⌂ Siedlung", hint: "Klick pflanzt einen Weiler — deterministisch, ein Undo-Schritt" },
  { id: "label", label: "A Label", hint: "Text eingeben, dann Klick platziert das Label" },
];

/** Werkzeuge, die flaches Gelände voraussetzen (A*-Routing bzw. Weiler-Layout). */
const TERRAIN_ONLY_TOOLS: ReadonlySet<Atlas3DEditorTool> = new Set(["river", "road", "settlement"]);

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
  const [rootCount, setRootCount] = useState(6);
  const [regionPointCount, setRegionPointCount] = useState(0);
  const [regionTitle, setRegionTitle] = useState("");
  const [regionBusy, setRegionBusy] = useState(false);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("gespeichert");
  const [webgl, setWebgl] = useState(true);
  const [describeOpen, setDescribeOpen] = useState(false);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [carvePanelOpen, setCarvePanelOpen] = useState(false);
  const [carveOps, setCarveOps] = useState<CarveOpSummary[]>([]);
  const [stampKind, setStampKind] = useState<TerrainStampKind>("krater");
  const [settlementWalls, setSettlementWalls] = useState(false);
  const [settlementCitadel, setSettlementCitadel] = useState(false);

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
      environment: { timeOfDay: props.timeOfDay.value, fogDensity: props.fogDensity.value, weather: props.weather.value },
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
            setRootCount(nextDoc.worldRoots);
            setCarveOps(summarizeCarveOps(nextDoc.carveOps));
            scheduleSave(nextDoc);
          },
          revert: () => {
            if (!prevDoc) return;
            appRef.current?.applyExternal(prevDoc);
            lastDocRef.current = prevDoc;
            setSplitGap(prevDoc.splitGap);
            setRootCount(prevDoc.worldRoots);
            setCarveOps(summarizeCarveOps(prevDoc.carveOps));
            scheduleSave(prevDoc);
          },
        });
      },
    });
    appRef.current = app;
    lastDocRef.current = app.getDocSnapshot();
    setSplitGap(lastDocRef.current.splitGap);
    setRootCount(lastDocRef.current.worldRoots);
    setCarveOps(summarizeCarveOps(lastDocRef.current.carveOps));
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
    form.set("normals", JSON.stringify(draft.normals));
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

  const setEnvironment = (field: "waterLevel" | "timeOfDay" | "fogDensity" | "weather", value: string) => {
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
        <button
          type="button"
          className={levelsOpen ? "atlas3d-tool on" : "atlas3d-tool"}
          aria-pressed={levelsOpen}
          onClick={() => setLevelsOpen((open) => !open)}
          data-testid="atlas3d-levels"
        >
          🌍 Ebenen
        </button>
        <button
          type="button"
          className={carvePanelOpen ? "atlas3d-tool on" : "atlas3d-tool"}
          aria-pressed={carvePanelOpen}
          onClick={() => setCarvePanelOpen((open) => !open)}
          data-testid="atlas3d-carve-ops"
        >
          ⛏ Eingriffe ({carveOps.length})
        </button>
        <span className="atlas3d-save" data-state={saveState} data-testid="atlas3d-save-state">
          ● {saveState}
        </span>
      </div>

      {levelsOpen ? (
        <Atlas3DLevelTree
          worldSlug={props.worldSlug}
          currentNodeId={props.nodeId}
          nodes={props.treeNodes}
          regionFeatures={props.regionFeatures}
          saveInFlight={saveState === "speichert …"}
          onBeforeReset={() => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          }}
          onClose={() => setLevelsOpen(false)}
        />
      ) : null}

      {carvePanelOpen ? (
        <div className="atlas3d-region" data-testid="atlas3d-carve-list">
          {carveOps.length === 0 ? <span>Keine Eingriffe — Biss- und Tunnel-Werkzeug benutzen.</span> : null}
          {carveOps.map((op) => (
            <span key={op.id} className="atlas3d-carve-item">
              {op.label}
              <button
                type="button"
                className="atlas3d-tool"
                title={`${op.label} entfernen`}
                aria-label={`${op.label} entfernen`}
                onClick={() => appRef.current?.removeCarveOp(op.id)}
              >
                🗑
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {tool === "stamp" ? (
        <div className="atlas3d-biomes" role="group" aria-label="Stempel-Profil wählen" data-testid="atlas3d-stamp-panel">
          {TERRAIN_STAMPS.map((stamp) => (
            <button
              key={stamp.key}
              type="button"
              className={stampKind === stamp.key ? "atlas3d-tool on" : "atlas3d-tool"}
              data-testid={`atlas3d-stamp-${stamp.key}`}
              aria-pressed={stampKind === stamp.key}
              onClick={() => {
                setStampKind(stamp.key);
                appRef.current?.setStamp(stamp.key);
              }}
            >
              {stamp.label}
            </button>
          ))}
          <span>Pinselgröße bestimmt die Ausdehnung.</span>
        </div>
      ) : null}

      {tool === "settlement" ? (
        <div className="atlas3d-region" data-testid="atlas3d-settlement-panel">
          <span>Siedlungs-Vorgaben:</span>
          <label className="atlas3d-check">
            <input
              type="checkbox"
              checked={settlementWalls}
              data-testid="atlas3d-settlement-walls"
              onChange={(event) => {
                setSettlementWalls(event.target.checked);
                appRef.current?.setSettlementOptions({ walls: event.target.checked });
              }}
            />
            Mauern + Türme
          </label>
          <label className="atlas3d-check">
            <input
              type="checkbox"
              checked={settlementCitadel}
              data-testid="atlas3d-settlement-citadel"
              onChange={(event) => {
                setSettlementCitadel(event.target.checked);
                appRef.current?.setSettlementOptions({ citadel: event.target.checked });
              }}
            />
            Zitadelle
          </label>
          <span>Dann auf die Karte klicken.</span>
        </div>
      ) : null}

      {tool === "asset" || tool === "scatter" ? (
        <div className="atlas3d-biomes" role="group" aria-label="Asset und Farbe wählen" data-testid="atlas3d-asset-panel">
          {INK_ASSET_GROUPS.map((group) => {
            const kinds = group.kinds.filter((kind) => !GLOBE_ONLY_ASSET_KINDS.includes(kind) || props.mode === "globe");
            if (kinds.length === 0) return null;
            return (
              <span key={group.key} className="atlas3d-asset-group" data-testid={`atlas3d-asset-group-${group.key}`}>
                <em>{group.label}:</em>
                {kinds.map((kind) => (
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
              </span>
            );
          })}
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
          <button
            type="button"
            className="atlas3d-tool"
            data-testid="atlas3d-derive-biomes"
            title="Biome aus Höhe × Klima ableiten — überschreibt die Biom-Malschicht (rückgängig möglich)"
            onClick={() => appRef.current?.deriveBiomes()}
          >
            ✨ Biome ableiten
          </button>
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

      <Atlas3DInspectorPanel
        mode={props.mode}
        appRef={appRef}
        waterLevel={props.waterLevel}
        timeOfDay={props.timeOfDay}
        fogDensity={props.fogDensity}
        weather={props.weather}
        brushRadius={brushRadius}
        onBrushRadius={setBrushRadius}
        splitGap={splitGap}
        onSplitGap={setSplitGap}
        rootCount={rootCount}
        onRootCount={setRootCount}
        onSetEnvironment={setEnvironment}
      />

      <Atlas3DBookmarksBar
        worldSlug={props.worldSlug}
        nodeId={props.nodeId}
        bookmarks={props.bookmarks}
        appRef={appRef}
        onSaved={() => router.refresh()}
      />

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
