import type { ReactNode } from "react";
import { cn } from "../components/cn";

export interface WorldCockpitCardProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function WorldCockpitCard({
  title,
  children,
  footer,
  className,
}: WorldCockpitCardProps) {
  return (
    <section
      /* uwe-glass-surface: reiner Theme-Hook für body.uwe-theme-frosted (uwe.css) */
      className={cn(
        "uwe-glass-surface flex min-h-[10rem] flex-col rounded-[var(--radius)] border border-border bg-card px-4 py-3 text-card-foreground shadow-sm",
        className,
      )}
    >
      <h2 className="mb-2 text-[0.92rem] font-semibold text-foreground">{title}</h2>
      <div className="flex-1">{children}</div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </section>
  );
}

export interface WorldCockpitHeaderProps {
  title: string;
  summary?: string | null;
  tags?: ReactNode;
  actions?: ReactNode;
}

export function WorldCockpitHeader({
  title,
  summary,
  tags,
  actions,
}: WorldCockpitHeaderProps) {
  return (
    <header className="mb-2 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="m-0 text-[clamp(1.5rem,2.5vw,2rem)] leading-[1.15]">{title}</h1>
        {summary ? (
          <p className="mt-[0.35rem] mb-0 max-w-[52ch] text-muted-foreground">{summary}</p>
        ) : null}
        {tags ? <div className="mt-[0.65rem] flex flex-wrap gap-[0.35rem]">{tags}</div> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}

export function WorldCockpitTag({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "accent" | "muted";
}) {
  // The uwe-cockpit-tag-{variant} modifier classes had no CSS rule anywhere in
  // the repo (dead selectors) — every variant rendered identically to the base
  // tag, so `variant` maps to the same utility string; only kept as data-attr.
  return (
    <span
      data-variant={variant}
      className="inline-flex items-center rounded-full border border-border bg-[color-mix(in_srgb,var(--uwe-surface)_80%,transparent)] px-[0.55rem] py-[0.15rem] text-[0.72rem] text-muted-foreground"
    >
      {children}
    </span>
  );
}
