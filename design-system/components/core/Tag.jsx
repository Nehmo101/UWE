import React from "react";

/**
 * UWE Tag — pill used for taxonomy/tags on wiki pages. Rounded, accent-tinted.
 */
export function Tag({ style = {}, children, ...rest }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "var(--uwe-text-xs)",
        padding: "0.15rem 0.5rem",
        borderRadius: "999px",
        background: "color-mix(in srgb, var(--uwe-accent) 15%, transparent)",
        color: "color-mix(in srgb, var(--uwe-accent) 35%, var(--uwe-fg) 65%)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
