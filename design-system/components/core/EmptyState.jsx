import React from "react";

/**
 * UWE EmptyState — centered placeholder for empty lists/panels. Common on
 * player Portal ("Keine Inhalte freigegeben") and empty Studio views.
 */
export function EmptyState({ icon = null, title, description, action = null, style = {}, ...rest }) {
  return (
    <div
      style={{
        padding: "var(--uwe-spacing-2xl) var(--uwe-spacing-xl)",
        border: "1px solid var(--uwe-border-muted)",
        borderRadius: "var(--uwe-radius-lg)",
        textAlign: "center",
        background: "color-mix(in srgb, var(--uwe-card-bg) 55%, transparent)",
        ...style,
      }}
      {...rest}
    >
      {icon && <div style={{ marginBottom: "0.75rem", opacity: 0.65, display: "flex", justifyContent: "center" }}>{icon}</div>}
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "var(--uwe-text-lg)", color: "var(--uwe-fg)" }}>{title}</h3>
      {description && (
        <p style={{ margin: "0 auto", maxWidth: "28rem", color: "var(--uwe-fg-muted)", lineHeight: 1.55, fontSize: "var(--uwe-text-base)" }}>
          {description}
        </p>
      )}
      {action && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--uwe-spacing-sm)", marginTop: "var(--uwe-spacing-lg)" }}>
          {action}
        </div>
      )}
    </div>
  );
}
