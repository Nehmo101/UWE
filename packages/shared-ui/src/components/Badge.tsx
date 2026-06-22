import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type BadgeVariant =
  | "default"
  | "accent"
  | "danger"
  | "warning"
  | "success"
  | "info"
  | "secret"
  | "player"
  | "public";

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: "uwe-badge",
  accent: "uwe-badge uwe-badge-accent",
  danger: "uwe-badge uwe-badge-danger",
  warning: "uwe-badge uwe-badge-warning",
  success: "uwe-badge uwe-badge-success",
  info: "uwe-badge uwe-badge-info",
  secret: "uwe-badge uwe-badge-secret",
  player: "uwe-badge uwe-badge-player",
  public: "uwe-badge uwe-badge-public",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(VARIANT_CLASS[variant], className)} {...props}>
      {children}
    </span>
  );
}
