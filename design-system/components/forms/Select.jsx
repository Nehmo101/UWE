import React from "react";
import { uweFieldStyle } from "./Input.jsx";

/** UWE Select — native select styled to match the field system. */
export function Select({ label, hint, options = [], children, style = {}, ...rest }) {
  const sel = (
    <select style={{ ...uweFieldStyle, ...style }} {...rest}>
      {children ??
        options.map((opt) => {
          const value = typeof opt === "string" ? opt : opt.value;
          const text = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
    </select>
  );
  if (!label) return sel;
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.875rem", fontWeight: 500, color: "var(--uwe-fg)" }}>
      {label}
      {sel}
      {hint && <span style={{ fontSize: "0.78rem", fontWeight: 400, color: "var(--uwe-fg-muted)" }}>{hint}</span>}
    </label>
  );
}
