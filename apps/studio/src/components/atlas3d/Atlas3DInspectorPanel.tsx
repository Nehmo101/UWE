"use client";

import { useState, type RefObject } from "react";
import type { Atlas3DEditorApp, Atlas3DEditorMode, GridOverlayKind } from "@uwe/atlas-3d/editor-app";

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

const TIME_OPTIONS = [
  { value: "morning", label: "Morgen" },
  { value: "noon", label: "Mittag" },
  { value: "evening", label: "Abend" },
  { value: "night", label: "Nacht" },
];

const WEATHER_OPTIONS = [
  { value: "klar", label: "Klar" },
  { value: "wolken", label: "Wolken" },
  { value: "regen", label: "Regen" },
  { value: "schnee", label: "Schnee" },
];

const GRID_OPTIONS: { value: GridOverlayKind; label: string }[] = [
  { value: "aus", label: "Aus" },
  { value: "quad", label: "Quadrat" },
  { value: "hex", label: "Hex" },
];

export interface Atlas3DInspectorPanelProps {
  mode: Atlas3DEditorMode;
  appRef: RefObject<Atlas3DEditorApp | null>;
  waterLevel: Atlas3DInheritedNumber;
  timeOfDay: Atlas3DInheritedText;
  fogDensity: Atlas3DInheritedNumber;
  weather: Atlas3DInheritedText;
  brushRadius: number;
  onBrushRadius: (radius: number) => void;
  splitGap: number;
  onSplitGap: (gap: number) => void;
  rootCount: number;
  onRootCount: (count: number) => void;
  onSetEnvironment: (field: "waterLevel" | "timeOfDay" | "fogDensity" | "weather", value: string) => void;
}

/** Inspector strip (brush + split + environment) — extracted from the shell for the file-size budget. */
export function Atlas3DInspectorPanel(props: Atlas3DInspectorPanelProps) {
  const [waterDraft, setWaterDraft] = useState(props.waterLevel.value);
  const [fogDraft, setFogDraft] = useState(props.fogDensity.value);
  const [gridKind, setGridKind] = useState<GridOverlayKind>("aus");
  const appRef = props.appRef;

  return (
    <div className="atlas3d-inspector">
      <label>
        Pinselgröße
        <input
          type="range"
          min={5}
          max={80}
          value={Math.round(props.brushRadius * 100)}
          onChange={(event) => {
            const radius = Number(event.target.value) / 100;
            props.onBrushRadius(radius);
            appRef.current?.setBrush({ radius });
          }}
        />
      </label>
      {props.mode === "globe" ? (
        <>
          <label>
            Spaltbreite (Welt teilen)
            <input
              type="range"
              min={0}
              max={60}
              value={Math.round(props.splitGap * 100)}
              data-testid="atlas3d-split-gap"
              onChange={(event) => {
                const gap = Number(event.target.value) / 100;
                props.onSplitGap(gap);
                appRef.current?.setSplitGap(gap);
              }}
              onPointerUp={() => appRef.current?.commitSplit()}
              onKeyUp={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") appRef.current?.commitSplit();
              }}
            />
            <em>{props.splitGap.toFixed(2)}</em>
          </label>
          {props.splitGap > 0.01 ? (
            <label>
              Weltwurzeln (Kerngehäuse)
              <input
                type="range"
                min={1}
                max={16}
                value={props.rootCount}
                data-testid="atlas3d-root-count"
                onChange={(event) => {
                  const count = Number(event.target.value);
                  props.onRootCount(count);
                  appRef.current?.setWorldRoots(count);
                }}
                onPointerUp={() => appRef.current?.commitSplit()}
                onKeyUp={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") appRef.current?.commitSplit();
                }}
              />
              <em>{props.rootCount}</em>
            </label>
          ) : null}
        </>
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
            onPointerUp={() => props.onSetEnvironment("waterLevel", String(waterDraft))}
          />
          <em>{waterDraft.toFixed(2)}</em>
          <span className="atlas3d-badge" data-testid="atlas3d-water-badge">
            {props.waterLevel.overridden ? (
              <>
                überschrieben ·{" "}
                <button type="button" className="atlas3d-inherit" onClick={() => props.onSetEnvironment("waterLevel", "inherit")}>
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
          onPointerUp={() => props.onSetEnvironment("fogDensity", String(fogDraft))}
        />
        <em>{fogDraft.toFixed(2)}</em>
        <span className="atlas3d-badge">
          {props.fogDensity.overridden ? (
            <>
              überschrieben ·{" "}
              <button type="button" className="atlas3d-inherit" onClick={() => props.onSetEnvironment("fogDensity", "inherit")}>
                ⤓ wieder erben
              </button>
            </>
          ) : (
            <>⤓ geerbt von {props.fogDensity.fromTitle}</>
          )}
        </span>
      </label>
      <label>
        Wetter
        <select
          value={props.weather.value}
          data-testid="atlas3d-weather-select"
          onChange={(event) => {
            appRef.current?.setEnvironmentVisuals({ weather: event.target.value });
            props.onSetEnvironment("weather", event.target.value);
          }}
        >
          {WEATHER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="atlas3d-badge">
          {props.weather.overridden ? (
            <>
              überschrieben ·{" "}
              <button type="button" className="atlas3d-inherit" onClick={() => props.onSetEnvironment("weather", "inherit")}>
                ⤓ wieder erben
              </button>
            </>
          ) : (
            <>⤓ geerbt von {props.weather.fromTitle}</>
          )}
        </span>
      </label>
      {props.mode === "terrain" ? (
        <label>
          Gitter
          <select
            value={gridKind}
            data-testid="atlas3d-grid-select"
            onChange={(event) => {
              const kind = event.target.value as GridOverlayKind;
              setGridKind(kind);
              appRef.current?.setGridOverlay(kind);
            }}
          >
            {GRID_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="atlas3d-badge">nur Ansicht</span>
        </label>
      ) : null}
      <label>
        Tageszeit
        <select
          value={props.timeOfDay.value}
          data-testid="atlas3d-time-select"
          onChange={(event) => {
            appRef.current?.setEnvironmentVisuals({ timeOfDay: event.target.value });
            props.onSetEnvironment("timeOfDay", event.target.value);
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
              <button type="button" className="atlas3d-inherit" onClick={() => props.onSetEnvironment("timeOfDay", "inherit")}>
                ⤓ wieder erben
              </button>
            </>
          ) : (
            <>⤓ geerbt von {props.timeOfDay.fromTitle}</>
          )}
        </span>
      </label>
    </div>
  );
}
