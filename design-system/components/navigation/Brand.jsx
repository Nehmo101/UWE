import React from "react";

/**
 * UWE Brand — the wordmark lockup. A boxed "U" glyph + "WE", with optional
 * subtitle. Matches the auth-shell brand mark. Sizes via `size`.
 */
export function Brand({ appName = "UWE", subtitle, size = "md", href, style = {}, ...rest }) {
  const scale = { sm: 0.85, md: 1, lg: 1.5 }[size] ?? 1;
  const [first, ...restName] = String(appName);
  const rest2 = restName.join("");
  const Wrapper = href ? "a" : "div";
  return (
    <Wrapper
      href={href}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.55rem", textDecoration: "none", color: "inherit", ...style }}
      {...rest}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: `${2 * scale}rem`,
          height: `${2 * scale}rem`,
          borderRadius: "0.35em",
          background: "linear-gradient(135deg, var(--uwe-accent), color-mix(in srgb, var(--uwe-accent) 70%, var(--uwe-bg-elevated)))",
          color: "#fff",
          fontFamily: "var(--uwe-font-mono)",
          fontSize: `${1.05 * scale}rem`,
          fontWeight: 800,
          boxShadow: "0 4px 20px color-mix(in srgb, var(--uwe-accent) 35%, transparent)",
        }}
      >
        {first}
      </span>
      <span style={{ lineHeight: 1.05 }}>
        <strong style={{ display: "block", fontSize: `${1.05 * scale}rem`, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--uwe-fg)" }}>
          {rest2 ? `${first}${rest2}` : first}
        </strong>
        {subtitle && (
          <small style={{ display: "block", fontSize: `${0.72 * scale}rem`, color: "var(--uwe-fg-subtle)" }}>{subtitle}</small>
        )}
      </span>
    </Wrapper>
  );
}
