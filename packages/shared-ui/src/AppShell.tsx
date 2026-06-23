"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  MobileBottomNav,
  MobileContextPanel,
  MobileSidebarContent,
  SidebarContextProvider,
  type BottomNavItem,
} from "./MobileComponents";
import { SidebarItem } from "./components/SidebarItem";

export interface AppShellProps {
  sidebar?: ReactNode;
  main: ReactNode;
  context?: ReactNode;
  topBar?: ReactNode;
  /** Optional desktop icon rail (left of sidebar) */
  rail?: ReactNode;
  /** Optional AI/system status strip below main content */
  statusFooter?: ReactNode;
  /** Optional bottom navigation bar (shown on mobile only) */
  bottomNav?: BottomNavItem[];
  /** Title for collapsible context panel on mobile */
  contextTitle?: string;
}

export function AppShell({
  sidebar,
  main,
  context,
  topBar,
  rail,
  statusFooter,
  bottomNav,
  contextTitle = "Details & Kontext",
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const hasSidebar = Boolean(sidebar);
  const hasContext = Boolean(context);
  const hasRail = Boolean(rail);
  const hasBottomNav = Boolean(bottomNav && bottomNav.length > 0);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);

  useEffect(() => {
    if (!sidebarOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeSidebar();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen, closeSidebar]);

  useEffect(() => {
    function onToggleSidebar() {
      toggleSidebar();
    }
    document.addEventListener("uwe:toggle-sidebar", onToggleSidebar);
    return () => document.removeEventListener("uwe:toggle-sidebar", onToggleSidebar);
  }, [toggleSidebar]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("uwe:sidebar-collapsed");
    if (stored === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        window.localStorage.setItem("uwe:sidebar-collapsed", next ? "true" : "false");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  /* Lock body scroll when mobile drawer is open */
  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  return (
    <SidebarContextProvider closeSidebar={closeSidebar}>
      <a href="#uwe-main-content" className="uwe-skip-link">
        Zum Inhalt springen
      </a>
      <div
        className="uwe-shell"
        data-sidebar-open={sidebarOpen ? "true" : "false"}
        data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
        data-has-bottom-nav={hasBottomNav ? "true" : "false"}
      >
        {topBar && (
          <header className="uwe-topbar">
            {hasSidebar && (
              <>
                <button
                  type="button"
                  className="uwe-mobile-nav-toggle"
                  aria-label={sidebarOpen ? "Navigation schließen" : "Navigation öffnen"}
                  aria-expanded={sidebarOpen}
                  aria-controls="uwe-sidebar"
                  onClick={toggleSidebar}
                >
                  <span className="uwe-mobile-nav-icon" aria-hidden />
                </button>
                <button
                  type="button"
                  className="uwe-sidebar-collapse-toggle"
                  aria-label={sidebarCollapsed ? "Menüband einblenden" : "Menüband einklappen"}
                  aria-pressed={sidebarCollapsed}
                  onClick={toggleSidebarCollapsed}
                  title={sidebarCollapsed ? "Menüband einblenden" : "Menüband einklappen"}
                >
                  <span className="uwe-sidebar-collapse-icon" aria-hidden />
                </button>
              </>
            )}
            <div className="uwe-topbar-inner">
              {topBar}
              <div id="uwe-topbar-end" className="uwe-topbar-end" />
            </div>
          </header>
        )}
        <div
          className="uwe-shell-body"
          data-has-sidebar={hasSidebar ? "true" : "false"}
          data-has-context={hasContext ? "true" : "false"}
          data-has-rail={hasRail ? "true" : "false"}
          data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
        >
          {hasRail && <div className="uwe-icon-rail-wrap">{rail}</div>}
          {hasSidebar && (
            <>
              <button
                type="button"
                className="uwe-sidebar-backdrop"
                aria-label="Navigation schließen"
                tabIndex={sidebarOpen ? 0 : -1}
                onClick={closeSidebar}
              />
              <aside id="uwe-sidebar" className="uwe-sidebar">
                <MobileSidebarContent>{sidebar}</MobileSidebarContent>
              </aside>
            </>
          )}
          <main id="uwe-main-content" className="uwe-main" tabIndex={-1}>
            {main}
          </main>
          {hasContext && (
            <>
              <aside className="uwe-context uwe-context-desktop">{context}</aside>
              <MobileContextPanel title={contextTitle}>{context}</MobileContextPanel>
            </>
          )}
        </div>
        {statusFooter}
        {hasBottomNav && bottomNav && <MobileBottomNav items={bottomNav} />}
      </div>
    </SidebarContextProvider>
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
    <nav className="uwe-sidebar-nav" aria-label="Seitennavigation">
      <ul>
        {items.map((item) => (
          <SidebarItem key={item.href} {...item} />
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
        enterKeyHint="search"
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
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="uwe-empty-state">
      {icon && <div className="uwe-empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="uwe-empty-action">{action}</div>}
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
      <div className="uwe-page-header-main">
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
