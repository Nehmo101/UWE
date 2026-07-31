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
          {stat.hint && <span className="mt-1 block text-[length:var(--uwe-text-2xs)] text-muted-foreground">{stat.hint}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * Ruhiger Leerzustand — nie alarmierend, immer mit einem nächsten Schritt.
 *
 * Die Form kommt seit dem v3-Fundament aus `design-v3/states.css`
 * (`.uwe-empty-v3`) statt aus Utilities an dieser Stelle. Zwei Dinge daran
 * sind nicht kosmetisch: der Titel stand vorher als `h3` in der Gliederung,
 * obwohl „Noch keine Einträge" keine Abschnittsüberschrift ist — ein
 * Screenreader las ihn als solche und die Überschriftenebene sprang. Und die
 * Textgrößen hingen an festen `rem`-Werten statt am Maßstab.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `uwe-empty-v3 ${className}` : "uwe-empty-v3"}>
      {icon && (
        <span className="uwe-empty-v3__glyph" aria-hidden>
          {icon}
        </span>
      )}
      <p className="uwe-empty-v3__title">{title}</p>
      {description && <p className="uwe-empty-v3__body">{description}</p>}
      {action}
    </div>
  );
}
