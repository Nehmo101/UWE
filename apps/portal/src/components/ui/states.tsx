import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { NavIcon } from "./icon";
import { cn } from "./cn";

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
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-border p-10 text-center",
        className,
      )}
    >
      <NavIcon name={icon} width={28} height={28} className="text-muted-foreground" />
      <div className="font-medium">{title}</div>
      {description ? <div className="max-w-sm text-sm text-muted-foreground">{description}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Error state with safe messaging (diagnostics passed in by caller). */
export function ErrorState({ icon = "shield", title, description, action, className }: StateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 p-10 text-center",
        className,
      )}
    >
      <NavIcon name={icon} width={28} height={28} className="text-destructive" />
      <div className="font-medium">{title}</div>
      {description ? <div className="max-w-sm text-sm text-muted-foreground">{description}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
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
