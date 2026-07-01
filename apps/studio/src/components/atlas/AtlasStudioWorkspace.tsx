"use client";

/**
 * Studio Atlas workspace (M4): mounts the single-file editor (AtlasStudioHost
 * iframe) and keeps the two AI tools the single-file runtime does NOT provide —
 * KI-Stempel generation and KI region description — as standalone Studio tools
 * beside the embed, so migrating to atlas.html loses no editor feature.
 */

import { useState } from "react";

import { AtlasStampGenerator } from "./AtlasStampGenerator";
import { AtlasStudioHost } from "./AtlasStudioHost";
import { RegionDescribePanel, type RegionDescribeTarget } from "./RegionDescribePanel";

export interface AtlasStudioWorkspaceProps {
  worldSlug: string;
  nodeId: string;
  /** Full DM-context atlas doc for the embedded editor (built server-side). */
  doc: Record<string, unknown>;
  /** Client palette key → real AtlasPaletteItem DB id (for save). */
  paletteIdMap?: Record<string, string>;
  /** Describable regions of the current node, for the AI describe tool. */
  regions?: RegionDescribeTarget[];
}

const toolBtn: React.CSSProperties = {
  height: 32,
  padding: "0 11px",
  borderRadius: 9,
  border: "1.5px solid var(--uwe-border, #e0d4ba)",
  background: "var(--uwe-bg-elevated, #fbf6ea)",
  color: "var(--uwe-fg, #211d17)",
  fontSize: 12,
  cursor: "pointer",
};

export function AtlasStudioWorkspace({
  worldSlug,
  nodeId,
  doc,
  paletteIdMap,
  regions = [],
}: AtlasStudioWorkspaceProps) {
  const [stampOpen, setStampOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [describeTarget, setDescribeTarget] = useState<RegionDescribeTarget | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div
        style={{
          flex: "none",
          display: "flex",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid var(--uwe-border, #e0d4ba)",
        }}
      >
        <button type="button" style={toolBtn} onClick={() => setStampOpen(true)}>
          ✦ KI-Stempel
        </button>
        <button
          type="button"
          style={{ ...toolBtn, opacity: regions.length === 0 ? 0.5 : 1 }}
          onClick={() => setPickerOpen(true)}
          disabled={regions.length === 0}
          title={regions.length === 0 ? "Keine Regionen auf dieser Ebene" : "KI-Beschreibung für eine Region"}
        >
          ✦ Region beschreiben
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <AtlasStudioHost worldSlug={worldSlug} doc={doc} paletteIdMap={paletteIdMap} />
      </div>

      {stampOpen && (
        <AtlasStampGenerator
          worldSlug={worldSlug}
          nodeId={nodeId}
          onClose={() => setStampOpen(false)}
          onSaved={() => setStampOpen(false)}
        />
      )}

      {pickerOpen && (
        <div
          role="dialog"
          aria-label="Region wählen"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
            zIndex: 50,
          }}
          onClick={() => setPickerOpen(false)}
        >
          <div
            style={{
              background: "var(--uwe-bg-elevated, #fbf6ea)",
              border: "1.5px solid var(--uwe-border, #e0d4ba)",
              borderRadius: 12,
              padding: 16,
              maxWidth: 360,
              width: "90%",
              maxHeight: "70vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Region für KI-Beschreibung wählen</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {regions.map((region, index) => (
                <button
                  key={index}
                  type="button"
                  style={{ ...toolBtn, justifyContent: "flex-start", textAlign: "left" }}
                  onClick={() => {
                    setDescribeTarget(region);
                    setPickerOpen(false);
                  }}
                >
                  {(region.labelText && region.labelText.trim()) || `Region (${region.kind})`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {describeTarget && (
        <RegionDescribePanel
          worldSlug={worldSlug}
          feature={describeTarget}
          onClose={() => setDescribeTarget(null)}
        />
      )}
    </div>
  );
}
