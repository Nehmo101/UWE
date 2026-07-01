import React from "react";

export const RTX_STATE_LABELS = {
  online: "RTX online",
  offline: "RTX offline",
  disabled: "RTX deaktiviert",
  starting: "RTX startet",
  error: "RTX Fehler",
};

/**
 * UWE RtxStatusBadge — the local-AI connector status pill. A colored dot plus
 * label. Appears across Studio to show whether the optional RTX Host Connector
 * (local GPU worker) is reachable. Never uppercased (unlike other badges).
 */
export function RtxStatusBadge({ state = "offline", label, style = {}, ...rest }) {
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
      data-rtx-state={state}
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
      {label ?? RTX_STATE_LABELS[state]}
    </span>
  );
}
