import React from "react";

/**
 * UWE Button. Mirrors the product's design-v2 button (`uwe-v2-btn`):
 * - primary  → solid ink fill (--uwe-fg) with page-bg text (Parchment OS signature)
 * - accent   → terracotta fill with a 2px ink border
 * - secondary/subtle/ghost/danger variants
 * All colors read from --uwe-* tokens so the button re-skins with the theme.
 */
export function Button({
  variant = "secondary",
  size = "md",
  as = "button",
  icon = null,
  iconAfter = null,
  disabled = false,
  fullWidth = false,
  style = {},
  children,
  ...rest
}) {
  const sizes = {
    sm: { minHeight: "1.85rem", padding: "0.3rem 0.65rem", fontSize: "0.8125rem" },
    md: { minHeight: "2.25rem", padding: "0.45rem 0.9rem", fontSize: "0.875rem" },
    lg: { minHeight: "2.75rem", padding: "0.6rem 1.15rem", fontSize: "0.95rem" },
  };

  const variants = {
    primary: {
      background: "var(--uwe-fg)",
      color: "var(--uwe-bg)",
      borderColor: "var(--uwe-fg)",
    },
    accent: {
      background: "var(--uwe-accent)",
      color: "var(--uwe-on-accent)",
      borderColor: "var(--uwe-fg)",
      borderWidth: "2px",
    },
    secondary: {
      background: "color-mix(in srgb, var(--uwe-card-bg) 70%, var(--uwe-bg) 30%)",
      color: "var(--uwe-fg)",
      borderColor: "var(--uwe-border-muted)",
    },
    subtle: {
      background: "color-mix(in srgb, var(--uwe-card-bg) 45%, transparent)",
      color: "var(--uwe-fg-muted)",
      borderColor: "var(--uwe-border-muted)",
    },
    ghost: {
      background: "transparent",
      color: "var(--uwe-fg)",
      borderColor: "transparent",
    },
    danger: {
      background: "color-mix(in srgb, var(--uwe-danger) 12%, var(--uwe-card-bg))",
      color: "var(--uwe-danger)",
      borderColor: "color-mix(in srgb, var(--uwe-danger) 45%, var(--uwe-border))",
    },
  };

  const Tag = as;
  return (
    <Tag
      disabled={Tag === "button" ? disabled : undefined}
      data-variant={variant}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.4rem",
        width: fullWidth ? "100%" : undefined,
        border: "1px solid",
        borderRadius: "var(--uwe-v2-radius-btn)",
        fontFamily: "inherit",
        fontWeight: 500,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        textDecoration: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "background var(--uwe-transition-fast), border-color var(--uwe-transition-fast), color var(--uwe-transition-fast)",
        ...sizes[size],
        ...variants[variant],
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
      {iconAfter}
    </Tag>
  );
}
