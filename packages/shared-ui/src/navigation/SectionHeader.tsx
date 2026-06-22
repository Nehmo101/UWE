import type { ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../AppShell";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface SectionHeaderProps {
  title: string;
  summary?: string | null;
  meta?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  backHref?: string;
  backLabel?: string;
}

/** Combined breadcrumb + page header for consistent section entry. */
export function SectionHeader({
  title,
  summary,
  meta,
  actions,
  breadcrumbs,
  backHref,
  backLabel = "Zurück",
}: SectionHeaderProps) {
  return (
    <div className="uwe-section-header">
      {backHref ? (
        <a href={backHref} className="uwe-back-link">
          ← {backLabel}
        </a>
      ) : null}
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumb items={breadcrumbs} /> : null}
      <PageHeader title={title} summary={summary} meta={meta} actions={actions} />
    </div>
  );
}
