import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  EmptyState as SharedEmptyState,
  ErrorState as SharedErrorState,
} from "@uwe/shared-ui";
import { NavIcon } from "./icon";
import { cn } from "./cn";

/**
 * Leer- und Fehlerzustand liegen seit dem v3-Fundament in `@uwe/shared-ui` und
 * tragen dort die Klassen aus `design-v3/states.css`: lesbare Schriftgrößen,
 * ein Zeichen zusätzlich zur Farbe, kein `h3` mehr für einen Satz, der keine
 * Abschnittsüberschrift ist.
 *
 * Diese Datei bleibt als Adapter stehen, damit die rund vierzig Aufrufstellen
 * in dieser App unverändert weiterlaufen: sie reicht das Lucide-Icon als
 * `icon`-Knoten durch — die gemeinsame Komponente kennt keine Icon-Bibliothek
 * und soll auch keine bekommen.
 */

const alertVariants = cva(
  "flex gap-3 rounded-[var(--radius)] border p-4 text-sm",
  {
    variants: {
      tone: {
        info: "border-border bg-popover text-popover-foreground",
        success: "border-border bg-popover text-popover-foreground",
        warning: "border-border bg-popover text-popover-foreground",
        danger: "border-destructive/40 bg-destructive/10 text-foreground",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof alertVariants> {
  icon?: string;
  title?: React.ReactNode;
}

/** Inline alert for info/success/warning/danger messages. */
export function Alert({ tone, icon, title, className, children, ...props }: AlertProps) {
  return (
    <div role="status" className={cn(alertVariants({ tone }), className)} {...props}>
      {icon ? <NavIcon name={icon} width={18} height={18} className="mt-0.5 shrink-0" /> : null}
      <div className="min-w-0">
        {title ? <div className="font-medium">{title}</div> : null}
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}

export interface StateProps {
  icon?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Calm empty state — never alarming. */
export function EmptyState({ icon = "inbox", title, description, action, className }: StateProps) {
  return (
    <SharedEmptyState
      icon={<NavIcon name={icon} width={28} height={28} />}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

/** Error state with safe messaging (diagnostics passed in by caller). */
export function ErrorState({ title, description, action, className }: StateProps) {
  // `icon` wird bewusst nicht mehr gerendert: das Fehlerzeichen kommt aus
  // `states.css` und steht damit auf jeder Fehlerfläche an derselben Stelle.
  return (
    <SharedErrorState
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

/** Quiet loading state. */
export function LoadingState({ title = "Lädt…", className }: { title?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground", className)}>
      <NavIcon name="loader" width={18} height={18} className="animate-spin" />
      <span>{title}</span>
    </div>
  );
}
