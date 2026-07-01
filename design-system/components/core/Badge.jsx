import React from "react";

/**
 * UWE Badge — the design-v2 badge. Uppercase, small, tokenized. Tone maps to
 * semantic colors. Used for statuses (publish, canon) across Studio.
 */
export function Badge({ tone = "neutral", style = {}, children, ...rest }) {
  const tones = {
    neutral: {
      border: "1px solid var(--uwe-border-muted)",
      background: "color-mix(in srgb, var(--uwe-card-bg) 80%, var(--uwe-bg) 20%)",
      color: "var(--uwe-fg-muted)",
    },
    accent: {
      border: "1px solid color-mix(in srgb, var(--uwe-accent) 35%, transparent)",
      background: "var(--uwe-accent-muted)",
      color: "var(--uwe-accent)",
    },
    danger: {
      border: "1px solid color-mix(in srgb, var(--uwe-danger) 35%, transparent)",
      background: "color-mix(in srgb, var(--uwe-danger) 10%, transparent)",
      color: "var(--uwe-danger)",
    },
    success: {
      border: "1px solid color-mix(in srgb, var(--uwe-success) 35%, transparent)",
      background: "color-mix(in srgb, var(--uwe-success) 10%, transparent)",
      color: "var(--uwe-success)",
    },
    warning: {
      border: "1px solid color-mix(in srgb, var(--uwe-warning) 35%, transparent)",
      background: "color-mix(in srgb, var(--uwe-warning) 10%, transparent)",
      color: "var(--uwe-warning)",
    },
  };

  return (
    <span
      data-tone={tone}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.15rem 0.5rem",
        borderRadius: "var(--uwe-radius-sm)",
        fontSize: "var(--uwe-text-xs)",
        fontWeight: 600,
        letterSpacing: "0.02em",
        lineHeight: 1.3,
        textTransform: "uppercase",
        ...tones[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
