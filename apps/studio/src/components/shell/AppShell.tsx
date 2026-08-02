"use client";

import * as React from "react";
import Link from "next/link";
import type { NavCommand, ResolvedNavGroup } from "@uwe/shared-utils/navigation";
import { dedupeNavSearchEntries } from "@uwe/shared-utils/nav-search";
import {
  MobileBottomNav,
  NavSearch,
  SidebarContextProvider,
  ThemeModeToggle,
  type BottomNavItem,
} from "@uwe/shared-ui";
import { studioCommands } from "../../navigation/studio-nav";
import { NavIcon } from "../ui/icon";
import { Sheet, SheetContent, SheetClose, SheetTrigger } from "../ui/sheet";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../ui/cn";
import { ChevronRight } from "lucide-react";

export interface AppShellProps {
  /** Resolved navigation groups (with active flags) for the sidebar. */
  groups: ResolvedNavGroup[];
  /** Command palette entries (Cmd/Ctrl+K). */
  commands?: NavCommand[];
  brandLabel: string;
  brandHref?: string;
  breadcrumb?: React.ReactNode;
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
  contextPanel,
  footer,
  bottomNav,
  children,
}: AppShellProps) {
  const hasBottomNav = Boolean(bottomNav && bottomNav.length > 0);

  // Die Suchleiste findet immer die gesamte Studio-IA — auch aus einer Welt
  // heraus, wo `commands` nur die Welt-Navigation enthält. Die Reihenfolge
  // stellt den aktuellen Kontext voran, das Dedupe verhindert Doppelungen.
  const searchEntries = React.useMemo(
    () => dedupeNavSearchEntries([...commands, ...studioCommands()]),
    [commands],
  );

  return (
    <SidebarContextProvider closeSidebar={() => undefined}>
      <div
        className="flex h-dvh w-full overflow-hidden bg-background text-foreground"
        data-has-bottom-nav={hasBottomNav ? "true" : "false"}
      >
        {/*
          Sprungmarke — bewusst als **erstes** Element im Shell und damit vor
          der Sidebar. Stünde sie weiter unten (etwa neben der Topbar), käme
          ein Tastaturnutzer erst nach den über sechzig Navigationszielen an
          ihr vorbei, und sie erfüllte ihren Zweck nicht mehr. Sichtbar wird
          sie erst beim Fokussieren (siehe .uwe-skip-link in design-v3).
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
            <MobileNav groups={groups} brandLabel={brandLabel} />
            <div className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:block">
              {breadcrumb}
            </div>
            <NavSearch
              entries={searchEntries}
              className="min-w-0 flex-1 sm:max-w-64 lg:max-w-80"
              placeholder="Bereich suchen… (z. B. KI)"
              renderIcon={(hit) => <NavIcon name={hit.icon ?? "arrow-right"} width={16} height={16} />}
            />
            <div id="uwe-topbar-end" className="flex shrink-0 items-center gap-2" />
            <ThemeModeToggle />
            {commands.length > 0 ? <CommandHint /> : null}
          </header>

          <div className="flex min-h-0 flex-1">
            <main
              id="uwe-main"
              // Ohne tabIndex springt der Fokus beim Klick auf die Sprungmarke
              // zwar an die Stelle, landet aber auf keinem Element — die
              // nächste Tab-Taste führte zurück in die Navigation.
              tabIndex={-1}
              className={cn(
                "min-w-0 flex-1 overflow-y-auto p-4 md:p-6",
                hasBottomNav && "studio-main-with-bottom-nav",
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

          {hasBottomNav && bottomNav ? (
            <div className="md:hidden">
              <MobileBottomNav items={bottomNav} />
            </div>
          ) : null}
        </div>

        {/*
         * The Cmd/Ctrl+K palette is intentionally NOT mounted here. It lives once
         * globally in app/layout.tsx (StudioCommandPalette) so a single listener and
         * a single palette serve the whole app. `commands` still drives the ⌘K hint.
         */}
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

const SIDEBAR_GROUPS_KEY = "uwe:studio-sidebar-groups-v1";
/** Groups open on first visit regardless of the active route (small, high-traffic areas). */
const DEFAULT_OPEN_GROUP_IDS = ["start", "worlds"];

/*
 * Die Gruppenköpfe trugen früher je ein eigenes Glyph (GROUP_ICONS). Bei elf
 * Gruppen und einundzwanzig Zielen ergab das zwei Icon-Spalten in derselben
 * Größe — Kopf und Ziel sahen gleich schwer aus, und die Gliederung, die der
 * Kopf eigentlich herstellen soll, verschwand in der Wiederholung. Die Icons
 * bleiben jetzt den Zielen vorbehalten; der Kopf ist eine ruhige
 * Versalien-Beschriftung mit Aufklapp-Pfeil.
 */

function readStoredGroups(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SIDEBAR_GROUPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeStoredGroups(value: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / private-mode failures
  }
}

/**
 * Collapsible, grouped sidebar navigation. Open/closed state per group persists
 * in localStorage; the group holding the active route is always expanded so the
 * current location is never hidden.
 */
function SidebarNav({ groups }: { groups: ResolvedNavGroup[] }) {
  const activeGroupId = React.useMemo(
    () => groups.find((group) => group.items.some((item) => item.active))?.id,
    [groups],
  );

  const computeDefaults = React.useCallback(() => {
    const stored = readStoredGroups();
    const next: Record<string, boolean> = {};
    for (const group of groups) {
      next[group.id] =
        group.id === activeGroupId
          ? true
          : (stored[group.id] ?? DEFAULT_OPEN_GROUP_IDS.includes(group.id));
    }
    return next;
  }, [groups, activeGroupId]);

  const [openMap, setOpenMap] = React.useState<Record<string, boolean>>(computeDefaults);

  React.useEffect(() => {
    setOpenMap(computeDefaults());
  }, [computeDefaults]);

  const setGroupOpen = React.useCallback((id: string, open: boolean) => {
    setOpenMap((current) => {
      const next = { ...current, [id]: open };
      writeStoredGroups(next);
      return next;
    });
  }, []);

  return (
    <nav className="flex min-w-0 flex-col gap-1.5 p-3">
      {groups.map((group) => {
        const items = group.items.filter((item) => item.status !== "hidden");
        if (items.length === 0) return null;
        const open = openMap[group.id] ?? false;
        return (
          <SidebarNavGroup
            key={group.id}
            group={group}
            items={items}
            open={open}
            onToggle={(event) => {
              // Stop the click from bubbling to the mobile drawer's SheetClose.
              event.stopPropagation();
              setGroupOpen(group.id, !open);
            }}
          />
        );
      })}
    </nav>
  );
}

function SidebarNavGroup({
  group,
  items,
  open,
  onToggle,
}: {
  group: ResolvedNavGroup;
  items: ResolvedNavGroup["items"];
  open: boolean;
  onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const bodyId = `sidebar-group-${group.id}`;
  const active = items.some((item) => item.active);
  return (
    <div className="flex min-w-0 flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className={cn(
          // Die Höhe hängt am Breakpoint, nicht an einem Kompromiss: in der
          // Schublade (unter md) bleibt der Kopf ein 44-px-Touch-Ziel, auf dem
          // Desktop ist er ein reiner Aufklapper und darf schmal sein. Elf
          // Gruppen mal 44 px waren allein 484 px Überschrift — der Grund,
          // warum die Leiste sich als endlose Versalien-Wand las.
          "flex min-h-11 w-full min-w-0 appearance-none items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1 transition-colors hover:bg-sidebar-foreground/10 md:min-h-7",
          // Der Kopf ist Gliederung, nicht Ziel: er tritt bewusst hinter die
          // Einträge zurück. Vorher trug er font-bold in voller Textfarbe und
          // wog damit schwerer als das, was er gruppiert.
          // /65 ist keine gerundete Zahl, sondern der Boden: #cfc4ab bei 65 %
          // auf rgb(33,29,23) misst 4.89:1 und hält damit AA für Fließtext.
          // Der erste Entwurf stand bei /55 — optisch schöner zurückgenommen,
          // aber nur 3.95:1 und damit durchgefallen.
          active
            ? "text-sidebar-foreground/90"
            : "text-sidebar-foreground/65 hover:text-sidebar-foreground/90",
        )}
      >
        {/*
          Der Schriftgrad sitzt am <span>, nicht am <button> — und das ist keine
          Stilfrage. `type-scale.css` setzt ungelayert `button { font-size:
          inherit }`; ungelayerte Regeln schlagen jede Tailwind-Utility aus
          `@layer utilities`, unabhängig von der Spezifität. Am Knopf verlor
          `text-[length:var(--uwe-text-2xs)]` deshalb stillschweigend, und die
          Versalien kamen mit 17 px statt 12 px heraus: bei Space Mono mit
          0.11em Sperrsatz sind das ~12 px pro Zeichen, also 209 px für
          „Knowledge & Brain" in einer 193 px breiten Spalte. Das <span> steht
          nicht in jener Elementliste und nimmt die Utility an.
        */}
        <span className="min-w-0 flex-1 truncate text-left text-[length:var(--uwe-text-2xs)] font-semibold uppercase tracking-[var(--uwe-tracking-caps)]">
          {group.title}
        </span>
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 opacity-70 transition-transform", open && "rotate-90")}
          aria-hidden
        />
      </button>
      <div
        id={bodyId}
        className={cn(
          // Die Führungslinie ersetzt den Einzug: bei elf Gruppen zeigt sie auf
          // einen Blick, wo eine Gruppe anfängt und aufhört.
          "mt-0.5 min-w-0 flex-col gap-px border-l border-sidebar-foreground/10 pb-1 pl-1.5 ml-2",
          open ? "flex" : "hidden",
        )}
      >
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              // min-h-11 = 44 px Trefferfläche in der Schublade; auf dem
              // Desktop reichen 32 px, sonst braucht die vollständige IA mehr
              // Höhe als jeder Bildschirm hat.
              "flex min-h-11 min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors md:min-h-8",
              // `no-underline` ist hier Pflicht, kein Geschmack: die Apps binden
              // Tailwind ohne Preflight ein (siehe app/globals.css), also gilt
              // für jeden <a> weiterhin die Unterstreichung des User-Agents.
              // Jedes Navigationsziel war unterstrichen. Dieselbe Falle wie bei
              // der Wortmarke oben.
              "no-underline",
              // Die Textfarbe steht hier bewusst NICHT als Utility: die
              // ungelayerte Regel `:is(.uwe-sidebar, .uwe-sidebar-surface)
              // a:not(.uwe-button-surface)` in uwe.css setzt --uwe-sidebar-fg
              // und schlägt jede Tailwind-Klasse aus @layer utilities. Ein
              // `text-sidebar-foreground/85` hier wäre toter Code, der eine
              // Abstufung vortäuscht, die im Browser nie ankommt (gemessen:
              // beide Zustände rgb(207,196,171), 9.7:1).
              //
              // Der aktive Zustand trägt deshalb Fläche, Gewicht und
              // Akzent-Icon statt einer Textfarbe — alle drei greifen.
              item.active
                ? "bg-primary/15 font-medium"
                : "hover:bg-sidebar-foreground/10",
              item.status === "planned" && "opacity-60",
            )}
          >
            <NavIcon
              name={item.icon}
              width={16}
              height={16}
              className={cn(
                "shrink-0",
                item.active ? "text-primary" : "text-sidebar-foreground/60",
              )}
            />
            <span className="min-w-0 truncate">{item.label}</span>
            {item.status === "planned" ? (
              <span className="ml-auto shrink-0 text-[length:var(--uwe-text-2xs)] font-semibold uppercase tracking-[var(--uwe-tracking-caps)] text-sidebar-foreground/70">
                bald
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

function MobileNav({ groups, brandLabel }: { groups: ResolvedNavGroup[]; brandLabel: string }) {
  return (
    <Sheet>
      <SheetTrigger
        // h-9 w-9 sind 36 px — unter der 44-px-Mindestgröße für Touch-Ziele,
        // und das ist ausgerechnet der Knopf, über den auf dem Telefon die
        // gesamte Navigation läuft.
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
