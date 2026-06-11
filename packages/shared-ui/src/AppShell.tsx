import type { ReactNode } from "react";

export interface AppShellProps {
  sidebar?: ReactNode;
  main: ReactNode;
  context?: ReactNode;
  topBar?: ReactNode;
}

export function AppShell({ sidebar, main, context, topBar }: AppShellProps) {
  const hasSidebar = Boolean(sidebar);
  const hasContext = Boolean(context);

  return (
    <div className="uwe-shell">
      {topBar && <header className="uwe-topbar">{topBar}</header>}
      <div
        className="uwe-shell-body"
        data-has-sidebar={hasSidebar ? "true" : "false"}
        data-has-context={hasContext ? "true" : "false"}
      >
        {hasSidebar && <aside className="uwe-sidebar">{sidebar}</aside>}
        <main className="uwe-main">{main}</main>
        {hasContext && <aside className="uwe-context">{context}</aside>}
      </div>
    </div>
  );
}

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

export function SidebarNav({
  items,
}: {
  items: { label: string; href: string; active?: boolean; badge?: string }[];
}) {
  return (
    <nav className="uwe-sidebar-nav">
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href} className={item.active ? "active" : undefined}>
              {item.label}
              {item.badge && <span className="uwe-nav-badge">{item.badge}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TopBarBrand({
  appName,
  subtitle,
  href = "/",
}: {
  appName: string;
  subtitle?: string;
  href?: string;
}) {
  return (
    <a href={href} className="uwe-brand">
      <span className="uwe-brand-mark">◆</span>
      <span>
        <strong>{appName}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </a>
  );
}

export function SearchField({
  action,
  placeholder = "Suchen…",
  defaultValue = "",
  name = "q",
}: {
  action: string;
  placeholder?: string;
  defaultValue?: string;
  name?: string;
}) {
  return (
    <form className="uwe-search" action={action} method="get">
      <input
        type="search"
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-label="Suche"
      />
    </form>
  );
}

export function StatGrid({
  stats,
}: {
  stats: { label: string; value: string | number; hint?: string }[];
}) {
  return (
    <div className="uwe-stat-grid">
      {stats.map((stat) => (
        <div key={stat.label} className="uwe-stat-card">
          <span className="uwe-stat-value">{stat.value}</span>
          <span className="uwe-stat-label">{stat.label}</span>
          {stat.hint && <span className="uwe-stat-hint">{stat.hint}</span>}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="uwe-empty-state">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  summary,
  meta,
  actions,
}: {
  title: string;
  summary?: string | null;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="uwe-page-header">
      <div>
        <h1>{title}</h1>
        {summary && <p className="uwe-page-summary">{summary}</p>}
        {meta && <div className="uwe-page-meta">{meta}</div>}
      </div>
      {actions && <div className="uwe-page-actions">{actions}</div>}
    </header>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="uwe-breadcrumb" aria-label="Brotkrumen">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {item.href ? <a href={item.href}>{item.label}</a> : item.label}
          {index < items.length - 1 && <span className="uwe-breadcrumb-sep">/</span>}
        </span>
      ))}
    </nav>
  );
}
