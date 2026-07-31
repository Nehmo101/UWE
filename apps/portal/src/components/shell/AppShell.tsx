"use client";

import * as React from "react";
import Link from "next/link";
import type { NavCommand, ResolvedNavGroup } from "@uwe/shared-utils/navigation";
import {
  MobileBottomNav,
  NavSearch,
  SidebarContextProvider,
  ThemeModeToggle,
  type BottomNavItem,
} from "@uwe/shared-ui";
import { NavIcon } from "../ui/icon";
import { CommandPalette } from "../ui/command-palette";
import { Sheet, SheetContent, SheetClose, SheetTrigger } from "../ui/sheet";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../ui/cn";

export interface AppShellProps {
  /** Resolved navigation groups (with active flags) for the sidebar. */
  groups: ResolvedNavGroup[];
  /** Command palette entries (Cmd/Ctrl+K). */
  commands?: NavCommand[];
  brandLabel: string;
  brandHref?: string;
  breadcrumb?: React.ReactNode;
  /** Top-bar actions (logout, studio link, etc.). */
  headerActions?: React.ReactNode;
  contextPanel?: React.ReactNode;
  footer?: React.ReactNode;
  /** Mobile thumb-zone navigation (shown below md breakpoint). */
  bottomNav?: BottomNavItem[];
  children: React.ReactNode;
}

/**
 * Central application shell: stable left sidebar + top bar (breadcrumb + global
 * command) + main content + optional right context panel, with a mobile drawer
 * fed from the same navigation source. Every product shell composes this.
 */
export function AppShell({
  groups,
  commands = [],
  brandLabel,
  brandHref = "/",
  breadcrumb,
  headerActions,
  contextPanel,
  footer,
  bottomNav,
  children,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const hasBottomNav = Boolean(bottomNav && bottomNav.length > 0);

  const closeMobileNav = React.useCallback(() => setMobileNavOpen(false), []);
  const toggleMobileNav = React.useCallback(() => setMobileNavOpen((open) => !open), []);

  React.useEffect(() => {
    function onToggleSidebar() {
      toggleMobileNav();
    }
    document.addEventListener("uwe:toggle-sidebar", onToggleSidebar);
    return () => document.removeEventListener("uwe:toggle-sidebar", onToggleSidebar);
  }, [toggleMobileNav]);

  return (
    <SidebarContextProvider closeSidebar={closeMobileNav}>
      <div
        className="flex h-dvh w-full overflow-hidden bg-background text-foreground"
        data-has-bottom-nav={hasBottomNav ? "true" : "false"}
      >
        {/*
          Sprungmarke — bewusst als **erstes** Element im Shell und damit vor
          der Sidebar. Stünde sie weiter unten, käme ein Tastaturnutzer erst
          nach der gesamten Wiki-Navigation an ihr vorbei, und sie erfüllte
          ihren Zweck nicht mehr. Sichtbar erst beim Fokussieren.
        */}
        <a href="#uwe-main" className="uwe-skip-link">
          Zum Inhalt springen
        </a>
        <aside className="uwe-sidebar-surface hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground md:flex">
          <SidebarBrand label={brandLabel} href={brandHref} />
          <ScrollArea variant="sidebar" className="min-h-0 flex-1">
            <SidebarNav groups={groups} />
          </ScrollArea>
          {footer ? (
            <div className="border-t border-border p-3 text-xs text-sidebar-foreground/70">{footer}</div>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-14 items-center gap-3 border-b border-border pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)]">
            <MobileNav
              groups={groups}
              brandLabel={brandLabel}
              open={mobileNavOpen}
              onOpenChange={setMobileNavOpen}
            />
            <div
              className={cn(
                "min-w-0 flex-1 truncate text-sm text-muted-foreground",
                // Auf schmalen Displays hat nur eines von beiden Platz — dort
                // gewinnt die Suche; die Brotkrumen kommen ab „sm" zurück.
                commands.length > 0 && "hidden sm:block",
              )}
            >
              {breadcrumb}
            </div>
            {commands.length > 0 ? (
              <NavSearch
                entries={commands}
                className="min-w-0 flex-1 sm:max-w-64 lg:max-w-80"
                placeholder="Bereich suchen…"
                renderIcon={(hit) => (
                  <NavIcon name={hit.icon ?? "arrow-right"} width={16} height={16} />
                )}
              />
            ) : null}
            {headerActions ? (
              <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
            ) : null}
            <ThemeModeToggle />
            {commands.length > 0 ? <CommandHint /> : null}
          </header>

          <div className="flex min-h-0 flex-1">
            <main
              id="uwe-main"
              tabIndex={-1}
              className={cn(
                "min-w-0 flex-1 overflow-y-auto p-4 md:p-6",
                hasBottomNav && "portal-main-with-bottom-nav",
              )}
            >
              {children}
            </main>
            {contextPanel ? (
              <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border p-4 lg:block">
                {contextPanel}
              </aside>
            ) : null}
          </div>
        </div>

        {commands.length > 0 ? <CommandPalette commands={commands} /> : null}
        {hasBottomNav && bottomNav ? <MobileBottomNav items={bottomNav} /> : null}
      </div>
    </SidebarContextProvider>
  );
}

function SidebarBrand({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      // Ohne explizite Farbe greift die globale `a`-Regel aus uwe.css und
      // färbt den Link mit --uwe-link. Auf der immer dunklen Sidebar sind das
      // 2.15:1 — der Markenname war praktisch unlesbar. Die Überschreibung in
      // ghibli-shell.css hängt an `.uwe-sidebar`; dieser Shell baut die
      // Seitenleiste aber mit `bg-sidebar` und wird davon nicht erfasst.
      className="flex h-14 items-center gap-2 border-b border-border px-4 font-semibold text-sidebar-foreground no-underline"
    >
      {label}
    </Link>
  );
}

function SidebarNav({ groups }: { groups: ResolvedNavGroup[] }) {
  return (
    <nav className="flex flex-col gap-4 p-3">
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          {/* `text-muted-foreground` ist die Farbe der *Seite*. Auf der immer
              dunklen Sidebar ergibt das im Hellmodus 1.5:1 — unsichtbar. */}
          <div className="px-2 text-[length:var(--uwe-text-2xs)] font-bold uppercase tracking-[var(--uwe-tracking-caps)] text-sidebar-foreground/70">
            {group.title}
          </div>
          {group.items
            .filter((item) => item.status !== "hidden")
            .map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  item.active
                    // `uwe-button-surface` ist hier kein Zierrat: die aktive
                    // Zeile ist eine gefüllte Fläche und bringt mit
                    // --uwe-on-accent ihr eigenes Gegenstück mit. Der Marker
                    // nimmt sie von der Sidebar-Linkfarbe aus (siehe uwe.css).
                    ? "uwe-button-surface bg-primary text-primary-foreground"
                    // Sidebar-Fläche, nicht die Seiten-Fläche: der Hover muss
                    // auf der dunklen Tinte sichtbar bleiben (beide Themes).
                    : "text-sidebar-foreground hover:bg-sidebar-foreground/10",
                  item.status === "planned" && "opacity-60",
                )}
              >
                <NavIcon name={item.icon} width={16} height={16} />
                <span className="truncate">{item.label}</span>
                {item.status === "planned" ? (
                  <span className="ml-auto text-[length:var(--uwe-text-2xs)] font-semibold uppercase tracking-[var(--uwe-tracking-caps)] text-muted-foreground">
                    bald
                  </span>
                ) : null}
              </Link>
            ))}
        </div>
      ))}
    </nav>
  );
}

function MobileNav({
  groups,
  brandLabel,
  open,
  onOpenChange,
}: {
  groups: ResolvedNavGroup[];
  brandLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger
        // 36 px lagen unter der 44-px-Mindestgröße für Touch-Ziele — und das
        // ist der Knopf, über den auf dem Telefon die ganze Navigation läuft.
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border md:hidden"
        aria-label="Navigation öffnen"
      >
        <NavIcon name="menu" width={18} height={18} />
      </SheetTrigger>
      <SheetContent side="left" title={brandLabel} className="uwe-sidebar-surface">
        <div className="mb-2 px-2 font-semibold">{brandLabel}</div>
        <ScrollArea variant="sidebar" className="min-h-0 flex-1">
          <SheetClose asChild>
            <div>
              <SidebarNav groups={groups} />
            </div>
          </SheetClose>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function CommandHint() {
  return (
    <kbd className="hidden items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground sm:inline-flex">
      <span>⌘</span>K
    </kbd>
  );
}
