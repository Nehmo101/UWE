/**
 * Nicht-destruktiver Höhen-Layer-Stack — Unreal-Landscape-Edit-Layers-Prinzip.
 *
 * Statt EINER Höhenkarte hält der Editor einen Stapel benannter Layer; jedes
 * Werkzeug schreibt in den aktiven Layer, gerendert wird die Summe aller
 * sichtbaren Layer (Composite). Alles hier ist pure Datenlogik ohne three.js:
 * deterministisch, serialisierbar, testbar. Das Aktiv-Layer-Konzept ist
 * bewusst Sache des Aufrufers (siehe editor-height-layers.ts).
 */

import {
  createHeightmap,
  heightmapFromJson,
  heightmapToJson,
  type HeightmapGrid,
  type HeightmapJson,
} from "./planet-field";

export interface HeightLayer {
  id: string;
  name: string;
  visible: boolean;
  grid: HeightmapGrid;
}

export interface HeightLayerStack {
  width: number;
  height: number;
  layers: HeightLayer[];
}

/** Richtung für moveLayer — deutsch, wie die UI-Pfeile. */
export type HeightLayerMoveDir = "hoch" | "runter";

export const HEIGHT_BASE_LAYER_NAME = "Basis";

/** Deterministische Layer-Ids: „ebene-N" mit N = höchste vorhandene Nummer + 1. */
function nextLayerId(stack: HeightLayerStack): string {
  let max = 0;
  for (const layer of stack.layers) {
    const match = /^ebene-(\d+)$/.exec(layer.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `ebene-${max + 1}`;
}

/** Frischer Stack mit genau einem sichtbaren Basis-Layer. */
export function createLayerStack(width: number, height: number): HeightLayerStack {
  return {
    width,
    height,
    layers: [{ id: "ebene-1", name: HEIGHT_BASE_LAYER_NAME, visible: true, grid: createHeightmap(width, height) }],
  };
}

/** Neuen (leeren, sichtbaren) Layer oben anhängen; leerer Name → „Ebene N". */
export function addLayer(stack: HeightLayerStack, name: string): HeightLayer {
  const trimmed = name.trim();
  const layer: HeightLayer = {
    id: nextLayerId(stack),
    name: trimmed.length > 0 ? trimmed : `Ebene ${stack.layers.length + 1}`,
    visible: true,
    grid: createHeightmap(stack.width, stack.height),
  };
  stack.layers.push(layer);
  return layer;
}

/** Layer entfernen; der letzte verbleibende Layer ist unlöschbar. */
export function removeLayer(stack: HeightLayerStack, id: string): boolean {
  if (stack.layers.length <= 1) return false;
  const index = stack.layers.findIndex((layer) => layer.id === id);
  if (index === -1) return false;
  stack.layers.splice(index, 1);
  return true;
}

/** Layer in der Liste verschieben („hoch" = Richtung Index 0). */
export function moveLayer(stack: HeightLayerStack, id: string, dir: HeightLayerMoveDir): boolean {
  const index = stack.layers.findIndex((layer) => layer.id === id);
  if (index === -1) return false;
  const target = dir === "hoch" ? index - 1 : index + 1;
  if (target < 0 || target >= stack.layers.length) return false;
  const tmp = stack.layers[index];
  stack.layers[index] = stack.layers[target];
  stack.layers[target] = tmp;
  return true;
}

export function setLayerVisible(stack: HeightLayerStack, id: string, on: boolean): boolean {
  const layer = stack.layers.find((entry) => entry.id === id);
  if (!layer) return false;
  layer.visible = on;
  return true;
}

/**
 * Composite: Summe aller sichtbaren Layer als neue Höhenkarte. Bei der Summe
 * ist die Reihenfolge mathematisch egal — die Stack-Reihenfolge bleibt
 * trotzdem erhalten (UI-Liste). Layer mit abweichender Größe werden defensiv
 * übersprungen (kommt bei regulär gebauten Stacks nicht vor).
 */
export function compositeLayers(layers: readonly HeightLayer[]): HeightmapGrid {
  if (layers.length === 0) throw new Error("Layer-Stack ist leer — mindestens ein Layer erwartet");
  const { width, height } = layers[0].grid;
  const out = createHeightmap(width, height);
  for (const layer of layers) {
    if (!layer.visible) continue;
    if (layer.grid.width !== width || layer.grid.height !== height) continue;
    const data = layer.grid.data;
    for (let i = 0; i < data.length; i++) out.data[i] += data[i];
  }
  return out;
}

// --- Serialisierung -------------------------------------------------------------

export interface HeightLayerJsonEntry {
  id: string;
  name: string;
  visible: boolean;
  grid: HeightmapJson;
}

export interface HeightLayersJson {
  version: 1;
  layers: HeightLayerJsonEntry[];
}

export function layersToJson(stack: HeightLayerStack): HeightLayersJson {
  return {
    version: 1,
    layers: stack.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      grid: heightmapToJson(layer.grid),
    })),
  };
}

/** Strikte Validierung: kaputte Struktur → null (der Aufrufer migriert/startet frisch). */
export function layersFromJson(value: unknown): HeightLayerStack | null {
  if (typeof value !== "object" || value === null) return null;
  const json = value as Partial<HeightLayersJson>;
  if (json.version !== 1 || !Array.isArray(json.layers) || json.layers.length === 0) return null;
  const layers: HeightLayer[] = [];
  const seenIds = new Set<string>();
  for (const entry of json.layers) {
    if (typeof entry !== "object" || entry === null) return null;
    const { id, name, visible } = entry as Partial<HeightLayerJsonEntry>;
    if (typeof id !== "string" || id.length === 0 || seenIds.has(id)) return null;
    if (typeof name !== "string" || typeof visible !== "boolean") return null;
    const grid = heightmapFromJson((entry as Partial<HeightLayerJsonEntry>).grid);
    if (!grid) return null;
    seenIds.add(id);
    layers.push({ id, name, visible, grid });
  }
  const { width, height } = layers[0].grid;
  if (layers.some((layer) => layer.grid.width !== width || layer.grid.height !== height)) return null;
  return { width, height, layers };
}

/** Legacy-Migration: einzelnes Heightmap-JSON → Stack mit einem Basis-Layer. */
export function layerStackFromLegacyHeightmap(value: unknown): HeightLayerStack | null {
  const grid = heightmapFromJson(value);
  if (!grid) return null;
  return {
    width: grid.width,
    height: grid.height,
    layers: [{ id: "ebene-1", name: HEIGHT_BASE_LAYER_NAME, visible: true, grid }],
  };
}
