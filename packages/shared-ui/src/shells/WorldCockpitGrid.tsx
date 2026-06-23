import type { ReactNode } from "react";

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
    <section className={`uwe-card uwe-cockpit-card${className ? ` ${className}` : ""}`}>
      <h2 className="uwe-cockpit-card-title">{title}</h2>
      <div className="uwe-cockpit-card-body">{children}</div>
      {footer ? <div className="uwe-cockpit-card-footer">{footer}</div> : null}
    </section>
  );
}

export interface WorldCockpitGridProps {
  children: ReactNode;
}

/** Six-card cockpit overview grid (3×2 on desktop). */
export function WorldCockpitGrid({ children }: WorldCockpitGridProps) {
  return <div className="uwe-cockpit-grid">{children}</div>;
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
    <header className="uwe-cockpit-header">
      <div className="uwe-cockpit-header-main">
        <h1 className="uwe-cockpit-title">{title}</h1>
        {summary ? <p className="uwe-cockpit-summary">{summary}</p> : null}
        {tags ? <div className="uwe-cockpit-tags">{tags}</div> : null}
      </div>
      {actions ? <div className="uwe-cockpit-header-actions">{actions}</div> : null}
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
  return (
    <span className={`uwe-cockpit-tag uwe-cockpit-tag-${variant}`}>{children}</span>
  );
}
