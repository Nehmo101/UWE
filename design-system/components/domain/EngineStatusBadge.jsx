import React from "react";

export const ENGINE_STATE_LABELS = {
  online: "Maschinenraum online",
  offline: "Maschinenraum offline",
  disabled: "Maschinenraum deaktiviert",
  starting: "Maschinenraum startet",
  error: "Maschinenraum Fehler",
};

/**
 * UWE EngineStatusBadge — the local-AI connector status pill. A colored dot plus
 * label. Appears across Studio to show whether the optional Maschinenraum
 * (local GPU worker) is reachable. Never uppercased (unlike other badges).
 */
export function EngineStatusBadge({ state = "offline", label, style = {}, ...rest }) {
  const map = {
    online: { c: "var(--uwe-success)" },
    starting: { c: "var(--uwe-warning)" },
    offline: { c: "var(--uwe-danger)" },
    error: { c: "var(--uwe-danger)" },
    disabled: { c: "var(--uwe-fg-muted)" },
  };
  const dot = map[state]?.c ?? "var(--uwe-fg-subtle)";
  return (
    <span
      data-engine-state={state}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4em",
        fontSize: "var(--uwe-text-xs)",
        fontWeight: 600,
        padding: "0.2rem 0.5rem",
        borderRadius: "var(--uwe-radius-sm)",
        border: "1px solid",
        borderColor: `color-mix(in srgb, ${dot} 30%, transparent)`,
        background: `color-mix(in srgb, ${dot} 14%, transparent)`,
        color: `color-mix(in srgb, ${dot} 72%, var(--uwe-fg) 28%)`,
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      <span style={{ width: "0.5rem", height: "0.5rem", borderRadius: "999px", background: dot, flex: "none" }} />
      {label ?? ENGINE_STATE_LABELS[state]}
    </span>
  );
}
