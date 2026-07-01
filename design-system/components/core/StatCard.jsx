import React from "react";

/**
 * UWE StatCard — compact metric tile used across dashboards
 * (Today, World overview). Big value, muted label, optional hint.
 */
export function StatCard({ value, label, hint, style = {}, ...rest }) {
  return (
    <div
      style={{
        padding: "var(--uwe-spacing-md) var(--uwe-spacing-lg)",
        borderRadius: "var(--uwe-radius-lg)",
        border: "1px solid var(--uwe-zone-card-border)",
        background: "var(--uwe-zone-card-bg)",
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          display: "block",
          fontSize: "1.35rem",
          fontWeight: 700,
          lineHeight: 1.2,
          color: "var(--uwe-zone-heading-fg)",
        }}
      >
        {value}
      </span>
      <span style={{ display: "block", marginTop: "0.25rem", fontSize: "var(--uwe-text-sm)", color: "var(--uwe-fg-muted)" }}>
        {label}
      </span>
      {hint && (
        <span style={{ display: "block", marginTop: "0.25rem", fontSize: "var(--uwe-text-xs)", color: "var(--uwe-fg-subtle)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}
