"use client";

import { useState, type RefObject } from "react";
import type { Atlas3DEditorApp, Atlas3DEditorTool, Atlas3DStampChoice } from "@uwe/atlas-3d/editor-app";
import { TERRAIN_STAMPS } from "@uwe/atlas-3d/stamps";
import { AREA_FILL_KINDS, type AreaFillKindKey } from "@uwe/atlas-3d/area-fill";
import { LANDMASS_TEMPLATES } from "@uwe/atlas-3d/landmass-templates";
import { generatePlaceName, NAME_CULTURES, type NameCultureKey } from "@uwe/atlas-3d/names";

/**
 * Werkzeug-Panels des Atlas-3D-Editors — aus der Shell ausgelagert
 * (file-size budget). Bestehende data-testids bleiben unverändert (e2e).
 */

export interface Atlas3DToolPanelsProps {
  tool: Atlas3DEditorTool;
  mode: "globe" | "terrain";
  seed: number;
  appRef: RefObject<Atlas3DEditorApp | null>;
  /** Punktzahl des Fläche-/Gebiet-Polygon-Drafts. */
  polygonPoints: number;
}

const TERRITORY_TINTS: { key: string; color: string; label: string }[] = [
  { key: "paper", color: "#f1e8d4", label: "Papier" },
  { key: "sepia", color: "#7a5a3a", label: "Sepia" },
  { key: "terra", color: "#c2622b", label: "Terrakotta" },
  { key: "teal", color: "#2f6f63", label: "Teal" },
  { key: "blue", color: "#35597e", label: "Tintenblau" },
  { key: "gefahr", color: "#c2622b", label: "Gefahr" },
  { key: "magie", color: "#35597e", label: "Magie" },
];

/** PNG → 64×64-Graustufen-Grid für den eigenen Stempel. */
function loadStampFromFile(file: File, app: Atlas3DEditorApp | null, onLoaded: (name: string) => void): void {
  if (!app) return;
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (context) {
      context.drawImage(image, 0, 0, 64, 64);
      const pixels = context.getImageData(0, 0, 64, 64).data;
      const data = new Float32Array(64 * 64);
      for (let i = 0; i < data.length; i++) {
        data[i] = (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / (3 * 255);
      }
      app.setCustomStamp({ width: 64, height: 64, data });
      app.setStamp("eigen");
      onLoaded(file.name);
    }
    URL.revokeObjectURL(url);
  };
  image.src = url;
}

export function Atlas3DToolPanels(props: Atlas3DToolPanelsProps) {
  const { tool, appRef, seed } = props;
  const [stampChoice, setStampChoice] = useState<Atlas3DStampChoice>("krater");
  const [customStampName, setCustomStampName] = useState<string | null>(null);
  const [settlementWalls, setSettlementWalls] = useState(false);
  const [settlementCitadel, setSettlementCitadel] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [erosionSize, setErosionSize] = useState(0.5);
  const [fillKind, setFillKind] = useState<AreaFillKindKey>("wald");
  const [territoryTint, setTerritoryTint] = useState("sepia");
  const [nameCulture, setNameCulture] = useState<NameCultureKey>("nordisch");
  const [nameIndex, setNameIndex] = useState(0);
  const [roadTrees, setRoadTrees] = useState(false);

  const rollName = () => {
    const name = generatePlaceName(nameCulture, seed, nameIndex);
    setNameIndex((index) => index + 1);
    setLabelDraft(name);
    appRef.current?.setLabelText(name);
    return name;
  };

  if (tool === "stamp") {
    const selectStamp = (kind: Atlas3DStampChoice) => {
      setStampChoice(kind);
      appRef.current?.setStamp(kind);
    };
    return (
      <div className="atlas3d-biomes" role="group" aria-label="Stempel-Profil wählen" data-testid="atlas3d-stamp-panel">
        {TERRAIN_STAMPS.map((stamp) => (
          <button
            key={stamp.key}
            type="button"
            className={stampChoice === stamp.key ? "atlas3d-tool on" : "atlas3d-tool"}
            data-testid={`atlas3d-stamp-${stamp.key}`}
            aria-pressed={stampChoice === stamp.key}
            onClick={() => selectStamp(stamp.key)}
          >
            {stamp.label}
          </button>
        ))}
        <button
          type="button"
          className={stampChoice === "mutation" ? "atlas3d-tool on" : "atlas3d-tool"}
          data-testid="atlas3d-stamp-mutation"
          aria-pressed={stampChoice === "mutation"}
          title="Region mit frischem Seed-Rauschen neu auswürfeln"
          onClick={() => selectStamp("mutation")}
        >
          Mutation
        </button>
        {customStampName ? (
          <button
            type="button"
            className={stampChoice === "eigen" ? "atlas3d-tool on" : "atlas3d-tool"}
            data-testid="atlas3d-stamp-eigen"
            aria-pressed={stampChoice === "eigen"}
            title={`Eigener Stempel: ${customStampName}`}
            onClick={() => selectStamp("eigen")}
          >
            Eigen
          </button>
        ) : null}
        <label className="atlas3d-tool">
          PNG laden
          <input
            type="file"
            accept="image/png,image/*"
            data-testid="atlas3d-stamp-file"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                loadStampFromFile(file, appRef.current, (name) => {
                  setCustomStampName(name);
                  setStampChoice("eigen");
                });
              }
              event.target.value = "";
            }}
          />
        </label>
        <span>Pinselgröße bestimmt die Ausdehnung.</span>
      </div>
    );
  }

  if (tool === "settlement") {
    return (
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
    );
  }

  if (tool === "label" || tool === "poi") {
    return (
      <div className="atlas3d-region" data-testid={tool === "poi" ? "atlas3d-poi-panel" : undefined}>
        <input
          type="text"
          placeholder={tool === "poi" ? "POI-Notiz" : "Label-Text"}
          value={labelDraft}
          data-testid={tool === "poi" ? "atlas3d-poi-text" : "atlas3d-label-text"}
          onChange={(event) => {
            setLabelDraft(event.target.value);
            appRef.current?.setLabelText(event.target.value);
          }}
        />
        <select
          value={nameCulture}
          aria-label="Namens-Kultur"
          onChange={(event) => setNameCulture(event.target.value as NameCultureKey)}
        >
          {NAME_CULTURES.map((culture) => (
            <option key={culture.key} value={culture.key}>
              {culture.label}
            </option>
          ))}
        </select>
        <button type="button" className="atlas3d-tool" data-testid="atlas3d-poi-roll" onClick={rollName}>
          🎲 Name würfeln
        </button>
        <span>Dann auf die Karte klicken.</span>
      </div>
    );
  }

  if (tool === "erode") {
    return (
      <div className="atlas3d-region" data-testid="atlas3d-erosion-panel">
        <label>
          Feature-Größe
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(erosionSize * 100)}
            data-testid="atlas3d-erosion-size"
            onChange={(event) => setErosionSize(Number(event.target.value) / 100)}
          />
          <em>{erosionSize.toFixed(2)}</em>
        </label>
        <button
          type="button"
          className="atlas3d-tool"
          data-testid="atlas3d-erosion-run"
          title="Verwittert die gesamte Höhenkarte (rückgängig möglich)"
          onClick={() => appRef.current?.applyErosionPass(erosionSize)}
        >
          ⛏ Erosion ausführen
        </button>
        <span>Oder Klicken/Ziehen auf der Karte — der Pinsel verwittert lokal.</span>
      </div>
    );
  }

  if (tool === "fill") {
    return (
      <div className="atlas3d-region" data-testid="atlas3d-fill-panel">
        {AREA_FILL_KINDS.map((kind) => (
          <button
            key={kind.key}
            type="button"
            className={fillKind === kind.key ? "atlas3d-tool on" : "atlas3d-tool"}
            data-testid={`atlas3d-fill-${kind.key}`}
            aria-pressed={fillKind === kind.key}
            onClick={() => setFillKind(kind.key)}
          >
            {kind.label}
          </button>
        ))}
        <span>
          {props.polygonPoints} Punkt{props.polygonPoints === 1 ? "" : "e"} gesetzt
          {props.polygonPoints < 3 ? " (mindestens 3)" : ""}
        </span>
        <button
          type="button"
          className="atlas3d-tool"
          data-testid="atlas3d-fill-run"
          disabled={props.polygonPoints < 3}
          onClick={() => appRef.current?.fillAreaDraft(fillKind)}
        >
          ▨ Füllen
        </button>
        <button
          type="button"
          className="atlas3d-tool"
          disabled={props.polygonPoints === 0}
          onClick={() => appRef.current?.clearPolygonDraft()}
        >
          Verwerfen
        </button>
      </div>
    );
  }

  if (tool === "territory") {
    return (
      <div className="atlas3d-region" data-testid="atlas3d-territory-panel">
        {TERRITORY_TINTS.map((tint) => (
          <button
            key={tint.key}
            type="button"
            className={territoryTint === tint.key ? "atlas3d-swatch on" : "atlas3d-swatch"}
            style={{ backgroundColor: tint.color }}
            title={tint.label}
            aria-pressed={territoryTint === tint.key}
            aria-label={`Gebietsfarbe ${tint.label}`}
            onClick={() => setTerritoryTint(tint.key)}
          />
        ))}
        <input
          type="text"
          placeholder="Name des Gebiets"
          value={labelDraft}
          data-testid="atlas3d-territory-name"
          onChange={(event) => setLabelDraft(event.target.value)}
        />
        <select
          value={nameCulture}
          data-testid="atlas3d-territory-culture"
          aria-label="Namens-Kultur"
          onChange={(event) => setNameCulture(event.target.value as NameCultureKey)}
        >
          {NAME_CULTURES.map((culture) => (
            <option key={culture.key} value={culture.key}>
              {culture.label}
            </option>
          ))}
        </select>
        <button type="button" className="atlas3d-tool" data-testid="atlas3d-territory-roll" onClick={rollName}>
          🎲 Name würfeln
        </button>
        <span>
          {props.polygonPoints} Punkt{props.polygonPoints === 1 ? "" : "e"}
          {props.polygonPoints < 3 ? " (mindestens 3)" : ""}
        </span>
        <button
          type="button"
          className="atlas3d-tool"
          data-testid="atlas3d-territory-create"
          disabled={props.polygonPoints < 3}
          onClick={() => appRef.current?.createTerritory({ tint: territoryTint, labelText: labelDraft })}
        >
          ◆ Gebiet anlegen
        </button>
      </div>
    );
  }

  if (tool === "road") {
    return (
      <div className="atlas3d-region" data-testid="atlas3d-road-panel">
        <label className="atlas3d-check">
          <input
            type="checkbox"
            checked={roadTrees}
            data-testid="atlas3d-road-trees"
            onChange={(event) => {
              setRoadTrees(event.target.checked);
              appRef.current?.setRoadTreesEnabled(event.target.checked);
            }}
          />
          Straße säumen (Bäume beidseitig)
        </label>
        <span>Zwei Klicks — der A*-Assistent umgeht Steigungen.</span>
      </div>
    );
  }

  return null;
}

/** Landmassen-Vorlagen: überschreibt die Höhenkarte der Ebene (rückgängig möglich). */
export function Atlas3DLandmassPanel({ appRef }: { appRef: RefObject<Atlas3DEditorApp | null> }) {
  return (
    <div className="atlas3d-region" data-testid="atlas3d-landmass-panel">
      <span>Landmassen-Vorlage:</span>
      {LANDMASS_TEMPLATES.map((template) => (
        <button
          key={template.key}
          type="button"
          className="atlas3d-tool"
          data-testid={`atlas3d-landmass-${template.key}`}
          onClick={() => {
            if (
              window.confirm(
                `Vorlage „${template.label}“ anwenden? Das überschreibt das Terrain dieser Ebene — rückgängig möglich.`,
              )
            ) {
              appRef.current?.applyLandmass(template.key);
            }
          }}
        >
          {template.label}
        </button>
      ))}
      <span>Deterministisch aus dem Seed der Ebene.</span>
    </div>
  );
}
