/**
 * Höhen-Layer-Session des Atlas-3D-Editors — bindet den puren Layer-Stack
 * (height-layers.ts) an den Editor-Lebenszyklus: Aktiv-Layer, Composite-Cache
 * (nur bei Änderung neu summiert) und Laden inkl. Legacy-Migration alter
 * Einzel-Heightmap-Stände. Aus editor-app.ts ausgelagert (file-size budget).
 */

import { heightmapToJson, type HeightmapGrid, type HeightmapJson } from "./planet-field";
import {
  addLayer,
  compositeLayers,
  createLayerStack,
  layerStackFromLegacyHeightmap,
  layersFromJson,
  layersToJson,
  moveLayer,
  removeLayer,
  setLayerVisible,
  type HeightLayerMoveDir,
  type HeightLayersJson,
  type HeightLayerStack,
} from "./height-layers";

export interface HeightLayerListItem {
  id: string;
  name: string;
  visible: boolean;
  active: boolean;
}

export class HeightLayerSession {
  private readonly fallbackWidth: number;
  private readonly fallbackHeight: number;
  private stack: HeightLayerStack;
  private activeId: string;
  private cache: HeightmapGrid | null = null;
  private dirty = true;

  constructor(fallbackWidth: number, fallbackHeight: number, layersJson: unknown, legacyHeightmap: unknown) {
    this.fallbackWidth = fallbackWidth;
    this.fallbackHeight = fallbackHeight;
    this.stack = this.parse(layersJson, legacyHeightmap);
    this.activeId = this.stack.layers[0].id;
  }

  private parse(layersJson: unknown, legacyHeightmap: unknown): HeightLayerStack {
    return (
      layersFromJson(layersJson) ??
      layerStackFromLegacyHeightmap(legacyHeightmap) ??
      createLayerStack(this.fallbackWidth, this.fallbackHeight)
    );
  }

  /** applyExternal/Undo: Stack neu laden; der Aktiv-Layer bleibt, wenn es ihn noch gibt. */
  load(layersJson: unknown, legacyHeightmap: unknown): void {
    this.stack = this.parse(layersJson, legacyHeightmap);
    if (!this.stack.layers.some((layer) => layer.id === this.activeId)) {
      this.activeId = this.stack.layers[0].id;
    }
    this.dirty = true;
  }

  /**
   * Grid des aktiven Layers — Ziel ALLER Sculpt-/Stempel-/Erosions-Mutationen.
   * Die Herausgabe markiert den Composite konservativ als veraltet (Aufrufer
   * holen das Grid ausschließlich, um es zu mutieren).
   */
  activeGrid(): HeightmapGrid {
    this.dirty = true;
    const active = this.stack.layers.find((layer) => layer.id === this.activeId);
    return (active ?? this.stack.layers[0]).grid;
  }

  /** Composite (Summe sichtbarer Layer), gecacht bis zur nächsten Änderung. */
  composite(): HeightmapGrid {
    if (this.dirty || !this.cache) {
      this.cache = compositeLayers(this.stack.layers);
      this.dirty = false;
    }
    return this.cache;
  }

  /** Composite als JSON — bleibt im Snapshot/Save als Abwärtskompatibilitäts-Pfad. */
  compositeJson(): HeightmapJson {
    return heightmapToJson(this.composite());
  }

  toJson(): HeightLayersJson {
    return layersToJson(this.stack);
  }

  list(): HeightLayerListItem[] {
    return this.stack.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      active: layer.id === this.activeId,
    }));
  }

  /** Neuer Layer wird sofort aktiv (leer → Composite bleibt unverändert). */
  add(name: string): void {
    const layer = addLayer(this.stack, name);
    this.activeId = layer.id;
  }

  remove(id: string): boolean {
    const removed = removeLayer(this.stack, id);
    if (removed) {
      if (this.activeId === id) this.activeId = this.stack.layers[0].id;
      this.dirty = true;
    }
    return removed;
  }

  setVisible(id: string, on: boolean): boolean {
    const changed = setLayerVisible(this.stack, id, on);
    if (changed) this.dirty = true;
    return changed;
  }

  move(id: string, dir: HeightLayerMoveDir): boolean {
    // reine Listen-Reihenfolge — die Summe (Composite) ändert sich nicht
    return moveLayer(this.stack, id, dir);
  }

  /** Reine UI-Auswahl, kein Commit — unbekannte Ids werden ignoriert. */
  setActive(id: string): boolean {
    if (!this.stack.layers.some((layer) => layer.id === id)) return false;
    this.activeId = id;
    return true;
  }
}
