import React from "react";

/**
 * UWE SidebarNav — the dark-ink sidebar navigation (Parchment OS signature).
 * Renders sections (title + items); active item gets a terracotta left-border
 * and bold weight. Designed to sit on --uwe-sidebar-bg (dark ink).
 * Each item: { label, href, icon?, active?, badge? }.
 */
export function SidebarNav({ sections = [], style = {}, ...rest }) {
  return (
    <nav
      aria-label="Seitennavigation"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        padding: "1.25rem 0.75rem",
        background: "var(--uwe-sidebar-bg)",
        color: "var(--uwe-sidebar-fg)",
        ...style,
      }}
      {...rest}
    >
      {sections.map((section, si) => (
        <div key={si}>
          {section.title && (
            <h3
              style={{
                margin: "0 0 0.5rem 0.65rem",
                fontSize: "var(--uwe-text-2xs)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--uwe-sidebar-fg-muted)",
              }}
            >
              {section.title}
            </h3>
          )}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {section.items.map((item, ii) => (
              <li key={ii} style={{ marginBottom: "0.15rem" }}>
                <a
                  href={item.href ?? "#"}
                  aria-current={item.active ? "page" : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.55rem",
                    padding: "0.5rem 0.65rem",
                    minHeight: "2.35rem",
                    borderLeft: "3px solid transparent",
                    borderLeftColor: item.active ? "var(--uwe-accent)" : "transparent",
                    background: item.active ? "color-mix(in srgb, var(--uwe-sidebar-bg) 86%, var(--uwe-sidebar-fg) 14%)" : "transparent",
                    color: item.active ? "var(--uwe-sidebar-fg)" : "var(--uwe-sidebar-fg-muted)",
                    fontWeight: item.active ? 700 : 400,
                    fontSize: "0.9rem",
                    textDecoration: "none",
                  }}
                >
                  {item.icon && <span style={{ display: "inline-flex", flex: "none" }}>{item.icon}</span>}
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge != null && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        padding: "0.1rem 0.35rem",
                        borderRadius: "999px",
                        background: "color-mix(in srgb, var(--uwe-sidebar-bg) 74%, var(--uwe-sidebar-fg) 26%)",
                        color: "var(--uwe-sidebar-fg-muted)",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
