"use client";

import * as React from "react";
import { NavIcon } from "@uwe/shared-ui";

export type MailButtonVariant = "accent" | "primary" | "secondary" | "subtle" | "danger";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

const BTN_VARIANT: Record<MailButtonVariant, string> = {
  accent: "bg-primary text-primary-foreground hover:bg-primary/90",
  primary: "bg-foreground text-background hover:bg-foreground/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  subtle: "border border-input bg-transparent hover:bg-muted",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

export interface MailButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: MailButtonVariant;
  size?: "sm" | "md";
  icon?: string;
  fullWidth?: boolean;
}

export function MailButton({
  variant = "secondary",
  size = "md",
  icon,
  fullWidth,
  children,
  className,
  ...rest
}: MailButtonProps) {
  const classes = [
    BTN_BASE,
    BTN_VARIANT[variant],
    size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 py-2 text-sm",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={classes} style={fullWidth ? { width: "100%" } : undefined} {...rest}>
      {icon ? <NavIcon name={icon} width={size === "sm" ? 15 : 15} height={size === "sm" ? 15 : 15} /> : null}
      {children}
    </button>
  );
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  size?: number;
  bordered?: boolean;
  tone?: "muted" | "danger" | "warning" | "accent";
}

const TONE_COLOR: Record<NonNullable<IconButtonProps["tone"]>, string> = {
  muted: "var(--uwe-fg-muted)",
  danger: "var(--uwe-danger)",
  warning: "var(--uwe-warning)",
  accent: "var(--uwe-accent)",
};

export function IconButton({
  icon,
  size = 17,
  bordered,
  tone = "muted",
  title,
  style,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: TONE_COLOR[tone],
        background: "transparent",
        border: bordered ? "1px solid var(--uwe-border-muted)" : "1px solid transparent",
        cursor: "pointer",
        flex: "none",
        ...style,
      }}
      {...rest}
    >
      <NavIcon name={icon} width={size} height={size} />
    </button>
  );
}

export function Avatar({
  initials,
  color,
  size = 34,
}: {
  initials: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        flex: "none",
        width: size,
        height: size,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--uwe-font-mono)",
        fontWeight: 700,
        fontSize: size < 34 ? 11 : 12,
        background: `color-mix(in srgb, ${color} 20%, var(--uwe-card-bg))`,
        color,
      }}
    >
      {initials}
    </span>
  );
}

export function Dot({ color, size = 8, square }: { color: string; size?: number; square?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: square ? 2 : 999,
        background: color,
        flex: "none",
        display: "inline-block",
      }}
    />
  );
}

export function EyebrowLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "var(--uwe-fg-subtle)",
        padding: "6px 8px 4px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A small action chip used in KI-Triage cards and the reader summary. */
export function ActionChip({
  icon,
  label,
  primary,
  onClick,
}: {
  icon: string;
  label: string;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: ".34rem .6rem",
        borderRadius: 9,
        fontSize: 12,
        fontFamily: "var(--uwe-font-mono)",
        fontWeight: 500,
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : "default",
        lineHeight: 1.1,
        background: primary ? "var(--uwe-accent)" : "var(--uwe-card-bg)",
        color: primary ? "var(--uwe-on-accent)" : "var(--uwe-fg)",
        border: primary ? "2px solid var(--uwe-fg)" : "1px solid var(--uwe-border)",
      }}
    >
      <NavIcon name={icon} width={14} height={14} />
      {label}
    </button>
  );
}
