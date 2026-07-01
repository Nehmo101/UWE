import React from "react";

const fieldStyle = {
  width: "100%",
  minHeight: "2.35rem",
  padding: "0.45rem 0.65rem",
  border: "1px solid var(--uwe-border)",
  borderRadius: "var(--uwe-radius-md)",
  background: "var(--uwe-input-bg)",
  color: "var(--uwe-fg)",
  font: "inherit",
  fontSize: "0.9rem",
  lineHeight: 1.4,
  transition: "border-color var(--uwe-transition-fast), box-shadow var(--uwe-transition-fast)",
};

/**
 * UWE Input — labelled text field (design-v2). Wrap-your-own-label variant:
 * pass `label` for a stacked label + hint, or use bare with your own <label>.
 */
export function Input({ label, hint, id, style = {}, ...rest }) {
  const input = <input id={id} style={{ ...fieldStyle, ...style }} {...rest} />;
  if (!label) return input;
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.875rem", fontWeight: 500, color: "var(--uwe-fg)" }}>
      {label}
      {input}
      {hint && <span style={{ fontSize: "0.78rem", fontWeight: 400, color: "var(--uwe-fg-muted)" }}>{hint}</span>}
    </label>
  );
}

export { fieldStyle as uweFieldStyle };
