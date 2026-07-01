import React from "react";

/**
 * UWE SecretReveal — the spoiler / GM-secret toggle. Content marked as a
 * campaign secret stays blurred behind a "Enthüllen" (reveal) affordance until
 * the reader opts in. Mirrors the product's SecretReveal + secret badge.
 */
export function SecretReveal({ label = "GM-Geheimnis", revealHint = "Enthüllen", defaultRevealed = false, children, style = {}, ...rest }) {
  const [revealed, setRevealed] = React.useState(defaultRevealed);
  return (
    <div
      style={{
        border: "1px solid color-mix(in srgb, var(--uwe-dm-only) 30%, var(--uwe-border))",
        borderRadius: "var(--uwe-radius-md)",
        background: "color-mix(in srgb, var(--uwe-dm-only) 6%, var(--uwe-card-bg))",
        overflow: "hidden",
        ...style,
      }}
      {...rest}
    >
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          width: "100%",
          padding: "0.5rem 0.75rem",
          border: "none",
          background: "transparent",
          color: "color-mix(in srgb, var(--uwe-dm-only) 78%, var(--uwe-fg) 22%)",
          font: "inherit",
          fontSize: "var(--uwe-text-xs)",
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        <span>{label}</span>
        <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
          {revealed ? "Verbergen" : revealHint}
        </span>
      </button>
      <div
        style={{
          padding: revealed ? "0 0.75rem 0.75rem" : "0 0.75rem 0.75rem",
          filter: revealed ? "none" : "blur(6px)",
          userSelect: revealed ? "auto" : "none",
          pointerEvents: revealed ? "auto" : "none",
          transition: "filter var(--uwe-transition)",
          color: "var(--uwe-fg)",
          fontSize: "var(--uwe-text-base)",
          lineHeight: 1.6,
        }}
        aria-hidden={!revealed}
      >
        {children}
      </div>
    </div>
  );
}
