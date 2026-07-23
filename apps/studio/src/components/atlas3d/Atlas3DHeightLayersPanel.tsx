"use client";

import { useState, type MutableRefObject } from "react";
import type { Atlas3DEditorApp, Atlas3DHeightLayerItem } from "@uwe/atlas-3d/editor-types";

/**
 * Höhen-Layer-Panel — nicht-destruktiver Layer-Stack nach dem
 * Unreal-Landscape-Edit-Layers-Prinzip. Alle Sculpt-Werkzeuge schreiben in den
 * aktiven Layer; gerendert wird die Summe der sichtbaren Layer. Strukturelle
 * Änderungen (anlegen, löschen, ein-/ausblenden, verschieben) laufen als
 * "sculpt"-Commit über den Command-Stack und sind damit undo-fähig; die
 * Aktiv-Auswahl ist reine UI ohne Commit.
 */
export interface Atlas3DHeightLayersPanelProps {
  layers: Atlas3DHeightLayerItem[];
  appRef: MutableRefObject<Atlas3DEditorApp | null>;
  /** Liste nach jeder Aktion aus listHeightLayers() nachziehen. */
  onChanged: () => void;
}

export function Atlas3DHeightLayersPanel({ layers, appRef, onChanged }: Atlas3DHeightLayersPanelProps) {
  const [newName, setNewName] = useState("");

  const run = (action: (app: Atlas3DEditorApp) => void) => {
    const app = appRef.current;
    if (!app) return;
    action(app);
    onChanged();
  };

  return (
    <div className="atlas3d-region" data-testid="atlas3d-height-layers-panel">
      <span>Höhen-Layer (Summe der sichtbaren; Werkzeuge formen den aktiven Layer):</span>
      {layers.map((layer, index) => (
        <span key={layer.id} className="atlas3d-carve-item" data-testid={`atlas3d-height-layer-${layer.id}`}>
          <button
            type="button"
            className={layer.active ? "atlas3d-tool on" : "atlas3d-tool"}
            aria-pressed={layer.active}
            title={layer.active ? `${layer.name} ist der aktive Layer` : `${layer.name} aktivieren`}
            data-testid={`atlas3d-height-layer-activate-${layer.id}`}
            onClick={() => run((app) => app.setActiveHeightLayer(layer.id))}
            style={layer.visible ? undefined : { opacity: 0.55 }}
          >
            {layer.active ? "✎ " : ""}
            {layer.name}
          </button>
          <button
            type="button"
            className="atlas3d-tool"
            title={layer.visible ? `${layer.name} ausblenden` : `${layer.name} einblenden`}
            aria-label={layer.visible ? `${layer.name} ausblenden` : `${layer.name} einblenden`}
            aria-pressed={layer.visible}
            data-testid={`atlas3d-height-layer-visible-${layer.id}`}
            onClick={() => run((app) => app.setHeightLayerVisible(layer.id, !layer.visible))}
          >
            {layer.visible ? "👁" : "🚫"}
          </button>
          <button
            type="button"
            className="atlas3d-tool"
            title={`${layer.name} nach oben`}
            aria-label={`${layer.name} nach oben`}
            disabled={index === 0}
            onClick={() => run((app) => app.moveHeightLayer(layer.id, "hoch"))}
          >
            ↑
          </button>
          <button
            type="button"
            className="atlas3d-tool"
            title={`${layer.name} nach unten`}
            aria-label={`${layer.name} nach unten`}
            disabled={index === layers.length - 1}
            onClick={() => run((app) => app.moveHeightLayer(layer.id, "runter"))}
          >
            ↓
          </button>
          <button
            type="button"
            className="atlas3d-tool"
            title={`${layer.name} löschen`}
            aria-label={`${layer.name} löschen`}
            disabled={layers.length <= 1}
            data-testid={`atlas3d-height-layer-remove-${layer.id}`}
            onClick={() => {
              if (!window.confirm(`Layer „${layer.name}“ wirklich löschen? Seine Höhen gehen verloren (rückgängig möglich).`)) {
                return;
              }
              run((app) => app.removeHeightLayer(layer.id));
            }}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        type="text"
        placeholder="Name des neuen Layers"
        value={newName}
        data-testid="atlas3d-height-layer-name"
        onChange={(event) => setNewName(event.target.value)}
      />
      <button
        type="button"
        className="atlas3d-tool"
        data-testid="atlas3d-height-layer-add"
        onClick={() => {
          run((app) => app.addHeightLayer(newName));
          setNewName("");
        }}
      >
        + Layer
      </button>
    </div>
  );
}
