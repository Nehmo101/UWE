import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/**
 * `uwe-button-surface` in der Basis ist kein Zierrat, sondern nötig, sobald ein
 * Badge als `<a>` gerendert wird (Tab-Leisten tun das): die globale
 * `a:not(.uwe-button-surface)`-Regel in uwe.css ist ungelayert und schlägt jede
 * Tailwind-Utility, egal wie spezifisch. Ohne den Marker stand ein
 * Akzent-Badge in der Linkfarbe auf der Akzentfüllung — Teal auf Terrakotta,
 * axe meldete „color-contrast", serious. Für `<span>` ist der Marker ein No-Op.
 */
const badgeVariants = cva(
  "uwe-button-surface inline-flex items-center gap-1 rounded-[var(--radius)] border px-2 py-0.5 text-xs font-medium no-underline",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-muted-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        accent: "border-transparent bg-primary text-primary-foreground",
        success: "border-success/30 bg-success/15 text-success",
        warning: "border-warning/30 bg-warning/15 text-warning",
        info: "border-info/30 bg-info/15 text-info",
        danger: "border-destructive/30 bg-destructive/15 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
