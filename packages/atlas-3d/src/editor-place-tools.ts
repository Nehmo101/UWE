/**
 * Platzierende Werkzeuge — Asset, Streuen, Siedlung und A*-Pfade (Fluss/
 * Straße inkl. „Straße säumen"). Aus dem Tools-Controller ausgelagert
 * (file-size budget); reine Funktionen über den EditorToolsContext.
 */

import type * as THREE from "three";
import type { InkAssetKind, InkTint } from "./assets-ink";
import { scatterInstances } from "./scatter";
import { generateSettlement3D } from "./settlement3d";
import { generateSettlementWFC } from "./wfc-settlement";
import { findTerrainPath, type PathKind } from "./terrain-path";
import { lineRoadWithTrees } from "./walls";
import type { EditorToolsContext } from "./editor-types";

/** Vom Controller gehaltener Zustand der platzierenden Werkzeuge. */
export interface PlacementState {
  assetKind: InkAssetKind;
  assetTint: InkTint;
  settlementWalls: boolean;
  settlementCitadel: boolean;
  /** WFC-Layout: Wave-Function-Collapse-Generator statt Ring-Layout. */
  settlementWfc: boolean;
  /** Straße säumen: Bäume beidseitig entlang neuer Straßen. */
  roadTrees: boolean;
}

export function placeAsset(ctx: EditorToolsContext, state: PlacementState, point: THREE.Vector3): void {
  const localId = ctx.nextLocalId();
  let position: Record<string, unknown>;
  if ((state.assetKind === "asteroid" || state.assetKind === "mond" || state.assetKind === "kometenstein") && ctx.mode === "globe") {
    const flat = Math.max(1.6, Math.hypot(point.x, point.z) + 0.6);
    const speed = state.assetKind === "mond" ? 0.06 : state.assetKind === "kometenstein" ? 0.18 : 0.12;
    position = { orbit: { radius: flat, inclination: point.y * 0.4, phase: Math.atan2(point.z, point.x), speed } };
  } else if (ctx.mode === "globe") {
    const dir = point.clone().normalize();
    position = { dir: [dir.x, dir.y, dir.z] };
  } else {
    position = { x: point.x, z: point.z };
  }
  ctx.setObjects([
    ...ctx.getObjects(),
    { localId, assetKind: state.assetKind, tint: state.assetTint, position, scale: 1, rotation: 0 },
  ]);
  ctx.syncObjects();
  ctx.commit("objects");
}

export function scatterAt(ctx: EditorToolsContext, state: PlacementState, point: THREE.Vector3): void {
  if (state.assetKind === "asteroid" || state.assetKind === "mond" || state.assetKind === "kometenstein") {
    // Orbit-Assets werden einzeln platziert statt gestreut
    placeAsset(ctx, state, point);
    return;
  }
  const center = ctx.mode === "globe" ? point.clone().normalize() : point;
  const cluster = scatterInstances({
    mode: ctx.mode,
    center: [center.x, center.y, center.z],
    radius: ctx.mode === "globe" ? ctx.getBrushRadius() * 0.6 : ctx.getBrushRadius() * 0.8,
    seed: ctx.seed,
  });
  ctx.setObjects([
    ...ctx.getObjects(),
    ...cluster.map((instance) => ({
      localId: ctx.nextLocalId(),
      assetKind: state.assetKind,
      tint: state.assetTint,
      position:
        ctx.mode === "globe"
          ? { dir: [instance.position[0], instance.position[1], instance.position[2]] }
          : { x: instance.position[0], z: instance.position[2] },
      scale: instance.scale,
      rotation: instance.rotation,
    })),
  ]);
  ctx.syncObjects();
  ctx.commit("objects");
}

export function placeSettlement(ctx: EditorToolsContext, state: PlacementState, point: THREE.Vector3): void {
  if (ctx.mode !== "terrain") return;
  const layoutSeed = ctx.seed + Math.round(point.x * 997) * 31 + Math.round(point.z * 997);
  const layout = {
    center: { x: point.x, z: point.z },
    seed: layoutSeed,
    idPrefix: ctx.nextLocalId(),
    walls: state.settlementWalls,
    citadel: state.settlementCitadel,
  };
  // WFC-Layout: Markt-Kern standardmäßig aktiv (kein eigenes UI-Flag)
  const settlement = state.settlementWfc
    ? generateSettlementWFC({ ...layout, market: true })
    : generateSettlement3D(layout);
  ctx.setObjects([...ctx.getObjects(), ...settlement.objects]);
  ctx.setFeatures([...ctx.getFeatures(), ...settlement.features]);
  ctx.syncObjects();
  ctx.commit("objects");
}

/**
 * Zwei-Klick-Pfad (Fluss/Straße): erster Klick liefert den neuen Startpunkt
 * zurück, der zweite routet per A*, hängt Feature (+ Baumreihen bei „Straße
 * säumen") an und committet. Rückgabe = neuer pathStart-Zustand.
 */
export function handlePathClick(
  ctx: EditorToolsContext,
  state: PlacementState,
  pathStart: { x: number; z: number } | null,
  point: THREE.Vector3,
  kind: PathKind,
): { x: number; z: number } | null {
  const field = ctx.getTerrainField();
  if (ctx.mode !== "terrain" || !field) return null;
  if (!pathStart) return { x: point.x, z: point.z };
  const routed = findTerrainPath(field, pathStart, { x: point.x, z: point.z }, { kind });
  if (!routed) return null;
  const points = routed.map((p) => ({ x: p.x, z: p.z }));
  ctx.setFeatures([...ctx.getFeatures(), { localId: ctx.nextLocalId(), kind, points }]);
  if (kind === "road" && state.roadTrees) {
    // Straße säumen: Bäume beidseitig entlang des gerouteten Pfads — gleicher Commit
    const trees = lineRoadWithTrees({ points, seed: ctx.seed });
    ctx.setObjects([
      ...ctx.getObjects(),
      ...trees.map((tree) => ({
        localId: ctx.nextLocalId(),
        assetKind: tree.assetKind as InkAssetKind,
        tint: tree.tint as InkTint,
        position: { x: tree.x, z: tree.z },
        scale: tree.scale,
        rotation: tree.rotation,
      })),
    ]);
  }
  ctx.syncObjects();
  ctx.commit("features");
  return null;
}
