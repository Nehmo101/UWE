"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFocusTrap } from "./useFocusTrap";
import { cn } from "./components/cn";

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
    // uwe-bottom-nav kept: (1) shared-ui.test.tsx asserts on the literal
    // strings "uwe-bottom-nav" and `class="active"` in the rendered output;
    // (2) layout/hover/focus-visible/active-state come from `.uwe-bottom-nav
    // a`, `.uwe-bottom-nav button`, `.uwe-bottom-nav a.active` descendant
    // selectors plus a shared multi-selector `:focus-visible` group (which
    // also covers `.uwe-bottom-nav a`, `.uwe-bottom-nav button`, ...) in
    // uwe.css; (3) glass/motion theme
    // overrides target `.uwe-bottom-nav` directly in uwe-visual-polish.css
    // (`html[data-uwe-glass="on|off"] .uwe-bottom-nav`); (4) visibility and
    // safe-area padding are driven by `.uwe-shell[data-has-bottom-nav]`
    // ancestor-state selectors that can't be expressed as static utilities
    // without editing uwe.css. TODO(design-kit): revisit once uwe.css is
    // migrated and the theme/glass toggles have Tailwind equivalents.
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
                <span className="text-[1.15rem] leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span className="max-w-full truncate text-[0.68rem] font-medium tracking-[0.01em]">
                  {item.label}
                </span>
              </button>
            ) : (
              <a
                href={item.href}
                className={item.active ? "active" : undefined}
                aria-current={item.active ? "page" : undefined}
                onClick={() => closeSidebar?.()}
              >
                <span className="text-[1.15rem] leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span className="max-w-full truncate text-[0.68rem] font-medium tracking-[0.01em]">
                  {item.label}
                </span>
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
    // uwe-sticky-action-bar kept: shared-ui.test.tsx asserts the string is
    // present in the rendered output; fixed/safe-area positioning is gated by
    // `.uwe-shell[data-has-bottom-nav="true"] .uwe-sticky-action-bar` (moves
    // the bar above the bottom nav), and glass/motion theme overrides target
    // `.uwe-sticky-action-bar` directly in uwe-visual-polish.css. A
    // `.uwe-sticky-action-bar` descendant-button rule also stretches
    // arbitrary `children` buttons to fill the row, which only works while
    // this class stays on the wrapper. TODO(design-kit): revisit once
    // uwe.css's shell/theme selectors are migrated.
    <div className="uwe-sticky-action-bar" role="toolbar" aria-label="Seitenaktionen">
      <div className="mx-auto flex max-w-3xl flex-wrap gap-2">{children}</div>
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
    <section data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="flex min-h-[var(--uwe-touch-min)] w-full cursor-pointer items-center gap-[0.65rem] rounded-[0.65rem] border border-border bg-card px-4 py-[0.85rem] text-left font-semibold text-foreground [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex-1">{title}</span>
        {summary && !open && (
          <span className="text-[0.8rem] font-normal text-muted-foreground">{summary}</span>
        )}
        <span
          className={cn(
            "h-2 w-2 flex-shrink-0 border-r-2 border-b-2 border-muted-foreground transition-transform duration-200",
            open ? "-rotate-[135deg]" : "rotate-[45deg]",
          )}
          aria-hidden
        />
      </button>
      <div id={id} className="pt-[0.85rem]" hidden={!open}>
        {children}
      </div>
    </section>
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
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const close = () => setOpen(false);

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    extraFocusablesRef: backdropRef,
    initialFocusRef: closeButtonRef,
    returnFocusRef: toggleRef,
    onEscape: close,
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    // uwe-filter-sheet itself has no CSS rule anywhere (grepped) — dropped.
    <div data-open={open ? "true" : "false"}>
      <div className="mb-4 hidden max-[960px]:block">
        <button
          ref={toggleRef}
          type="button"
          className="inline-flex min-h-[var(--uwe-touch-min)] cursor-pointer items-center gap-2 rounded-full border border-border bg-[color-mix(in_srgb,var(--uwe-surface)_65%,transparent)] px-4 py-[0.6rem] text-[0.9rem] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
        >
          {title}
          {activeCount > 0 && (
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-[0.35rem] text-[0.72rem] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </div>
      {open && (
        <button
          ref={backdropRef}
          type="button"
          // z-[44] mirrors the legacy stacking order (below the z-45 sheet
          // panel, above bottom-nav z-40 / sticky-action-bar z-35).
          className="fixed inset-0 z-[44] cursor-pointer border-0 bg-[color-mix(in_srgb,var(--uwe-bg)_50%,transparent)] p-0"
          aria-label="Filter schließen"
          onClick={close}
        />
      )}
      <div
        id={id}
        ref={panelRef}
        // uwe-filter-sheet-panel kept: mobile bottom-sheet slide-up
        // animation + glass/motion background switching live in
        // uwe-visual-polish.css (`html[data-uwe-glass="off"]
        // .uwe-filter-sheet-panel`, `html[data-uwe-motion="off"]
        // .uwe-filter-sheet-panel`, `@keyframes uwe-panel-in-mobile`), plus
        // themed scrollbar rules. TODO(design-kit): revisit once those
        // uwe.css/uwe-visual-polish.css selectors are migrated.
        className="uwe-filter-sheet-panel"
        hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between text-foreground">
          <strong>{title}</strong>
          <button
            ref={closeButtonRef}
            type="button"
            className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius)] px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            onClick={close}
          >
            Schließen
          </button>
        </div>
        {/* uwe-filter-sheet-content kept: `.uwe-filter-sheet-content
            .uwe-search-filters` / `.uwe-filter-sheet-content .uwe-btn` in
            uwe.css reach into arbitrary `children` content passed by
            consumers to stack filters and full-width buttons on mobile —
            can't be replicated from here without editing children markup we
            don't own. TODO(design-kit): revisit once callers pass
            Tailwind-based filter content. */}
        <div className="uwe-filter-sheet-content">{children}</div>
      </div>
      <div className="block max-[960px]:hidden">{children}</div>
    </div>
  );
}

