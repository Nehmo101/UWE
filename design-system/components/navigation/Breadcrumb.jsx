import React from "react";

/** UWE Breadcrumb — slash-separated trail. Muted, links to ancestors. */
export function Breadcrumb({ items = [], style = {}, ...rest }) {
  return (
    <nav
      aria-label="Brotkrumen"
      style={{ fontSize: "0.82rem", color: "var(--uwe-fg-muted)", marginBottom: "1rem", ...style }}
      {...rest}
    >
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`}>
          {item.href ? (
            <a href={item.href} style={{ color: "var(--uwe-fg-muted)" }}>
              {item.label}
            </a>
          ) : (
            item.label
          )}
          {i < items.length - 1 && <span style={{ margin: "0 0.35rem" }}>/</span>}
        </span>
      ))}
    </nav>
  );
}
