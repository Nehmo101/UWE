"use client";

import { useMemo } from "react";
import { generateChronicle, type ChronicleActor } from "@uwe/atlas-3d/chronicle";

export interface Atlas3DChroniclePanelProps {
  /** Seed der aktuellen Ebene — gleiche Eingaben ergeben dieselbe Chronik. */
  seed: number;
  actors: ChronicleActor[];
}

/** Deterministische Chronik der Ebene (Lore-Haken aus Seed + Akteuren). */
export function Atlas3DChroniclePanel(props: Atlas3DChroniclePanelProps) {
  const entries = useMemo(
    () => generateChronicle({ seed: props.seed, actors: props.actors }),
    [props.seed, props.actors],
  );
  return (
    <div className="atlas3d-tree-section" data-testid="atlas3d-chronicle-panel">
      <span>📜 Chronik (deterministisch aus Seed {props.seed}):</span>
      <ul className="atlas3d-chronicle">
        {entries.map((entry) => (
          <li key={`${entry.year}-${entry.text}`}>
            <em>Jahr {entry.year}</em> — {entry.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
