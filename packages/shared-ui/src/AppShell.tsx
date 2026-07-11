import type { ReactNode } from "react";

/*
 * Hinweis Shell-Phase (2026-07): Der Legacy-App-Rahmen (AppShell, SidebarNav,
 * TopBarBrand, SearchField, Breadcrumb, PageHeader) wurde entfernt — beide
 * Apps rendern seit der Design-Konsolidierung ihren eigenen Kit-Shell unter
 * apps/&lt;app&gt;/src/components/shell/. Übrig bleiben die weiterhin genutzten
 * Inhalts-Bausteine SidebarSection, StatGrid und EmptyState.
 *
 * uwe-sidebar-section bleibt Legacy-Klasse: Parchment-Theme-Skins stylen
 * `.uwe-sidebar-section h3` gezielt (uwe.css); Migration erst mit dem
 * Theme-Rebuild (docs/design/new-ui-stack.md).
 */

export function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="uwe-sidebar-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function StatGrid({
  stats,
}: {
  stats: { label: string; value: string | number; hint?: string }[];
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          /* uwe-glass-surface: reiner Theme-Hook für body.uwe-theme-frosted (uwe.css) */
          className="uwe-glass-surface rounded-[var(--radius)] border border-border bg-card px-5 py-4 transition-colors hover:border-[color-mix(in_srgb,var(--uwe-accent)_22%,var(--uwe-border-muted))]"
        >
          <span className="block text-2xl font-semibold leading-tight text-foreground">{stat.value}</span>
          <span className="block text-xs text-muted-foreground">{stat.label}</span>
          {stat.hint && <span className="mt-1 block text-[0.72rem] text-muted-foreground">{stat.hint}</span>}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-[color-mix(in_srgb,var(--uwe-card-bg)_55%,transparent)] px-8 py-12 text-center">
      {icon && <div className="mb-3 text-3xl opacity-65">{icon}</div>}
      <h3 className="m-0 mb-2 text-[1.05rem] not-italic text-foreground">{title}</h3>
      {description && <p className="mx-auto my-0 max-w-md leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
