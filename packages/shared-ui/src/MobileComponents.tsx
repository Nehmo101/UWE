"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";

/* ── Sidebar context (close drawer on navigation) ── */

const SidebarContext = createContext<{ closeSidebar: () => void } | null>(null);

export function useSidebarClose() {
  return useContext(SidebarContext)?.closeSidebar;
}

export function SidebarContextProvider({
  closeSidebar,
  children,
}: {
  closeSidebar: () => void;
  children: ReactNode;
}) {
  return (
    <SidebarContext.Provider value={{ closeSidebar }}>{children}</SidebarContext.Provider>
  );
}

/** Wrap sidebar content so link clicks close the mobile drawer. */
export function MobileSidebarContent({ children }: { children: ReactNode }) {
  const closeSidebar = useSidebarClose();

  return (
    <div
      className="uwe-sidebar-content"
      onClick={(event) => {
        const target = (event.target as HTMLElement).closest("a, button[type='submit']");
        if (target && closeSidebar) closeSidebar();
      }}
    >
      {children}
    </div>
  );
}

/* ── Bottom navigation ── */

export interface BottomNavItem {
  label: string;
  href?: string;
  icon: string;
  active?: boolean;
  /** Opens the sidebar drawer instead of navigating */
  action?: "open-sidebar";
}

export function MobileBottomNav({ items }: { items: BottomNavItem[] }) {
  const closeSidebar = useSidebarClose();

  return (
    <nav className="uwe-bottom-nav" aria-label="Hauptnavigation">
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            {item.action === "open-sidebar" ? (
              <button
                type="button"
                className={item.active ? "active" : undefined}
                aria-label={item.label}
                onClick={() => {
                  /* Toggle handled by AppShell via custom event */
                  document.dispatchEvent(new CustomEvent("uwe:toggle-sidebar"));
                }}
              >
                <span className="uwe-bottom-nav-icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="uwe-bottom-nav-label">{item.label}</span>
              </button>
            ) : (
              <a
                href={item.href}
                className={item.active ? "active" : undefined}
                aria-current={item.active ? "page" : undefined}
                onClick={() => closeSidebar?.()}
              >
                <span className="uwe-bottom-nav-icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="uwe-bottom-nav-label">{item.label}</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ── Sticky action bar (save, preview, delete) ── */

export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="uwe-sticky-action-bar" role="toolbar" aria-label="Seitenaktionen">
      <div className="uwe-sticky-action-bar-inner">{children}</div>
    </div>
  );
}

/* ── Collapsible section (forms, long content) ── */

export function CollapsibleSection({
  title,
  summary,
  defaultOpen = true,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="uwe-collapsible" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="uwe-collapsible-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="uwe-collapsible-title">{title}</span>
        {summary && !open && (
          <span className="uwe-collapsible-summary">{summary}</span>
        )}
        <span className="uwe-collapsible-chevron" aria-hidden />
      </button>
      <div id={id} className="uwe-collapsible-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}

/* ── Mobile context panel (sidebar info below main on mobile) ── */

export function MobileContextPanel({
  title = "Details",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className="uwe-mobile-context" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="uwe-mobile-context-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {title}
        <span className="uwe-collapsible-chevron" aria-hidden />
      </button>
      <div id={id} className="uwe-mobile-context-body" hidden={!open}>
        {children}
      </div>
    </div>
  );
}

/* ── Mobile filter sheet (search filters) ── */

export function MobileFilterSheet({
  title = "Filter",
  activeCount = 0,
  children,
}: {
  title?: string;
  activeCount?: number;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="uwe-filter-sheet" data-open={open ? "true" : "false"}>
      <div className="uwe-filter-sheet-bar">
        <button
          type="button"
          className="uwe-filter-sheet-toggle"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
        >
          {title}
          {activeCount > 0 && (
            <span className="uwe-filter-sheet-badge">{activeCount}</span>
          )}
        </button>
      </div>
      {open && (
        <button
          type="button"
          className="uwe-filter-sheet-backdrop"
          aria-label="Filter schließen"
          onClick={() => setOpen(false)}
        />
      )}
      <div id={id} className="uwe-filter-sheet-panel" hidden={!open} role="dialog" aria-label={title}>
        <div className="uwe-filter-sheet-header">
          <strong>{title}</strong>
          <button
            type="button"
            className="uwe-btn uwe-btn-ghost uwe-btn-sm"
            onClick={() => setOpen(false)}
          >
            Schließen
          </button>
        </div>
        <div className="uwe-filter-sheet-content">{children}</div>
      </div>
      <div className="uwe-filter-sheet-desktop">{children}</div>
    </div>
  );
}

/* ── Responsive page list (alternative to tables for page lists) ── */

export interface PageListItem {
  id: string;
  title: string;
  href: string;
  badges?: ReactNode;
  meta?: ReactNode;
}

export function PageListCards({ items }: { items: PageListItem[] }) {
  return (
    <ul className="uwe-page-list-cards">
      {items.map((item) => (
        <li key={item.id}>
          <a href={item.href} className="uwe-page-list-card">
            <span className="uwe-page-list-card-title">{item.title}</span>
            {item.badges && (
              <span className="uwe-page-list-card-badges">{item.badges}</span>
            )}
            {item.meta && <span className="uwe-page-list-card-meta">{item.meta}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
