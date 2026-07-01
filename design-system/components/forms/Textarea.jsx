import React from "react";
import { uweFieldStyle } from "./Input.jsx";

/** UWE Textarea — multiline field, vertically resizable. */
export function Textarea({ label, hint, style = {}, ...rest }) {
  const ta = (
    <textarea
      style={{ ...uweFieldStyle, minHeight: "5rem", resize: "vertical", ...style }}
      {...rest}
    />
  );
  if (!label) return ta;
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.875rem", fontWeight: 500, color: "var(--uwe-fg)" }}>
      {label}
      {ta}
      {hint && <span style={{ fontSize: "0.78rem", fontWeight: 400, color: "var(--uwe-fg-muted)" }}>{hint}</span>}
    </label>
  );
}
