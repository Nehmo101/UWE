import React from "react";

/**
 * UWE Card — the design-v2 panel. 1.5px border, 14px radius, subtle shadow,
 * elevated paper background. Optional serif title + footer divider.
 */
export function Card({ title, footer, padded = true, style = {}, children, ...rest }) {
  return (
    <div
      style={{
        border: "1.5px solid var(--uwe-zone-card-border)",
        borderRadius: "var(--uwe-v2-radius-card)",
        background: "var(--uwe-zone-card-bg)",
        boxShadow: "var(--uwe-shadow-sm)",
        overflow: "hidden",
        ...style,
      }}
      {...rest}
    >
      <div style={{ padding: padded ? "var(--uwe-content-gap)" : 0 }}>
        {title && (
          <h3
            style={{
              margin: "0 0 var(--uwe-spacing-sm)",
              fontFamily: "var(--uwe-font-serif)",
              fontSize: "var(--uwe-text-lg)",
              fontWeight: 600,
              color: "var(--uwe-zone-heading-fg)",
            }}
          >
            {title}
          </h3>
        )}
        {children}
        {footer && (
          <div
            style={{
              marginTop: "var(--uwe-spacing-md)",
              paddingTop: "var(--uwe-spacing-md)",
              borderTop: "1px solid var(--uwe-border-muted)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
