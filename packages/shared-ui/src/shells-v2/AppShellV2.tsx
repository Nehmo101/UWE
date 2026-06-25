"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  MobileSidebarContent,
  SidebarContextProvider,
  type BottomNavItem,
} from "../MobileComponents";
import { resolveV2BottomNavIcon, IconMenu } from "./icons";
import { useFocusTrap } from "../useFocusTrap";

export interface AppShellV2Props {
  sidebar?: ReactNode;
  main: ReactNode;
  context?: ReactNode;
  topBar?: ReactNode;
  rail?: ReactNode;
  statusFooter?: ReactNode;
  bottomNav?: BottomNavItem[];
  contextTitle?: string;
}

function V2MobileBottomNav({ items }: { items: BottomNavItem[] }) {
  return (
    <nav className="uwe-v2-bottom-nav" aria-label="Hauptnavigation">
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            {item.action === "open-sidebar" ? (
              <button
                type="button"
                className={item.active ? "active" : undefined}
                aria-label={item.label}
                onClick={() => {
                  document.dispatchEvent(new CustomEvent("uwe:toggle-sidebar"));
                }}
              >
                <span className="uwe-v2-bottom-nav-icon" aria-hidden>
                  {resolveV2BottomNavIcon(item.icon)}
                </span>
                <span className="uwe-v2-bottom-nav-label">{item.label}</span>
              </button>
            ) : (
              <a
                href={item.href}
                className={item.active ? "active" : undefined}
                aria-current={item.active ? "page" : undefined}
              >
                <span className="uwe-v2-bottom-nav-icon" aria-hidden>
                  {resolveV2BottomNavIcon(item.icon)}
                </span>
                <span className="uwe-v2-bottom-nav-label">{item.label}</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function V2MobileContextPanel({
  title = "Details",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="uwe-v2-context-mobile" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="uwe-v2-context-mobile-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {title}
      </button>
      {!open ? null : <div className="uwe-v2-context-mobile-body">{children}</div>}
    </div>
  );
}

/** Design V2 app shell — icon rail, sidebar, topbar, main, optional context panel. */
export function AppShellV2({
  sidebar,
  main,
  context,
  topBar,
  rail,
  statusFooter,
  bottomNav,
  contextTitle = "Details & Kontext",
}: AppShellV2Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hasSidebar = Boolean(sidebar);
  const hasContext = Boolean(context);
  const hasRail = Boolean(rail);
  const hasBottomNav = Boolean(bottomNav && bottomNav.length > 0);

  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarBackdropRef = useRef<HTMLButtonElement>(null);
  const sidebarToggleRef = useRef<HTMLButtonElement>(null);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);

  useFocusTrap({
    active: sidebarOpen,
    containerRef: sidebarRef,
    extraFocusablesRef: sidebarBackdropRef,
    returnFocusRef: sidebarToggleRef,
    onEscape: closeSidebar,
  });

  useEffect(() => {
    function onToggleSidebar() {
      toggleSidebar();
    }
    document.addEventListener("uwe:toggle-sidebar", onToggleSidebar);
    return () => document.removeEventListener("uwe:toggle-sidebar", onToggleSidebar);
  }, [toggleSidebar]);

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
      <a href="#uwe-v2-main-content" className="uwe-skip-link">
        Zum Inhalt springen
      </a>
      <div
        className="uwe-v2-shell"
        data-sidebar-open={sidebarOpen ? "true" : "false"}
        data-has-bottom-nav={hasBottomNav ? "true" : "false"}
      >
        {topBar ? (
          <header className="uwe-v2-topbar">
            {hasSidebar ? (
              <button
                ref={sidebarToggleRef}
                type="button"
                className="uwe-v2-mobile-nav-toggle"
                aria-label={sidebarOpen ? "Navigation schließen" : "Navigation öffnen"}
                aria-expanded={sidebarOpen}
                aria-controls="uwe-v2-sidebar"
                onClick={toggleSidebar}
              >
                <IconMenu />
              </button>
            ) : null}
            <div className="uwe-v2-topbar-inner">{topBar}</div>
          </header>
        ) : null}
        <div
          className="uwe-v2-shell-body"
          data-has-sidebar={hasSidebar ? "true" : "false"}
          data-has-context={hasContext ? "true" : "false"}
          data-has-rail={hasRail ? "true" : "false"}
        >
          {hasRail ? <div className="uwe-v2-rail">{rail}</div> : null}
          {hasSidebar ? (
            <>
              <button
                ref={sidebarBackdropRef}
                type="button"
                className="uwe-v2-sidebar-backdrop"
                aria-label="Navigation schließen"
                tabIndex={sidebarOpen ? 0 : -1}
                onClick={closeSidebar}
              />
              <aside id="uwe-v2-sidebar" ref={sidebarRef} className="uwe-v2-sidebar">
                <MobileSidebarContent>
                  <div className="uwe-v2-sidebar-content">{sidebar}</div>
                </MobileSidebarContent>
              </aside>
            </>
          ) : null}
          <main id="uwe-v2-main-content" className="uwe-v2-main" tabIndex={-1}>
            {main}
            {hasContext ? (
              <V2MobileContextPanel title={contextTitle}>{context}</V2MobileContextPanel>
            ) : null}
          </main>
          {hasContext ? (
            <aside className="uwe-v2-context uwe-v2-context-desktop">{context}</aside>
          ) : null}
        </div>
        {statusFooter}
        {hasBottomNav && bottomNav ? <V2MobileBottomNav items={bottomNav} /> : null}
      </div>
    </SidebarContextProvider>
  );
}

export function V2TopBarBrand({
  appName,
  subtitle,
  href = "/",
}: {
  appName: string;
  subtitle?: string;
  href?: string;
}) {
  return (
    <a href={href} className="uwe-v2-brand">
      <span className="uwe-v2-brand-mark" aria-hidden>
        ◆
      </span>
      <span>
        <strong>{appName}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </a>
  );
}

export function V2PageHeader({
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
        {summary ? <p className="uwe-page-summary">{summary}</p> : null}
        {meta ? <div className="uwe-page-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="uwe-page-actions">{actions}</div> : null}
    </header>
  );
}
