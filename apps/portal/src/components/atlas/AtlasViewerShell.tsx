"use client";

import { useState } from "react";

import { Atlas3DViewer } from "./Atlas3DViewer";
import { AtlasViewer, type AtlasViewerProps } from "./AtlasViewer";

export function AtlasViewerShell(props: AtlasViewerProps) {
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div role="group" aria-label="Atlas-Darstellung" style={{ display: "inline-flex", border: "1px solid var(--uwe-border)", borderRadius: 8, overflow: "hidden" }}>
          {(["2d", "3d"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              style={{ border: 0, padding: "0.45rem 0.8rem", cursor: "pointer", background: mode === value ? "var(--uwe-accent)" : "var(--uwe-surface)", color: mode === value ? "white" : "var(--uwe-fg)" }}
            >
              {value === "2d" ? "2D Karte" : "3D Gelände"}
            </button>
          ))}
        </div>
      </div>
      {mode === "2d" ? <AtlasViewer {...props} /> : <Atlas3DViewer {...props} />}
    </div>
  );
}
