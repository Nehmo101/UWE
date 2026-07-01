import React from "react";

/**
 * UWE PageHeader — title + optional summary, meta row, and right-aligned
 * actions. Title renders in the serif reader face. Bottom hairline divider.
 */
export function PageHeader({ title, summary, meta, actions, style = {}, ...rest }) {
  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "var(--uwe-content-gap)",
        marginBottom: "var(--uwe-section-gap)",
        paddingBottom: "var(--uwe-spacing-md)",
        borderBottom: "1px solid var(--uwe-border-muted)",
        ...style,
      }}
      {...rest}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--uwe-font-serif)",
            fontSize: "clamp(1.35rem, 2.5vw, 1.75rem)",
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "var(--uwe-tracking-tight)",
            color: "var(--uwe-zone-heading-fg)",
          }}
        >
          {title}
        </h1>
        {summary && (
          <p style={{ margin: "0.35rem 0 0", maxWidth: "42rem", color: "var(--uwe-fg-muted)", fontSize: "0.95rem", lineHeight: 1.5 }}>
            {summary}
          </p>
        )}
        {meta && (
          <div style={{ marginTop: "var(--uwe-spacing-sm)", display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
            {meta}
          </div>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--uwe-spacing-sm)" }}>{actions}</div>
      )}
    </header>
  );
}
