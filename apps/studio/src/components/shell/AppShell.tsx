"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { dedupeNavSearchEntries } from "@uwe/shared-utils/nav-search";
import {
  MobileBottomNav,
  NavSearch,
  SidebarContextProvider,
  ThemeModeToggle,
  crossAppBottomNavItems,
  useClientAppUrls,
} from "@uwe/shared-ui";
import { studioCommands, studioSidebar } from "../../navigation/studio-nav";
import { worldCommands, worldLiveNav, worldSidebar } from "../../navigation/world-nav";
import { deriveShellBreadcrumb } from "../../navigation/derive-breadcrumb";
import { liveSessionIdFromPathname } from "@/src/lib/active-world";
import { NavIcon } from "../ui/icon";
import { Sheet, SheetContent, SheetClose, SheetTrigger } from "../ui/sheet";
import { ScrollArea } from "../ui/scroll-area";
import { BreadcrumbTrail } from "./BreadcrumbTrail";
import { SidebarNav, type SidebarBlock } from "./SidebarNav";
import { WorldSwitcher } from "./WorldSwitcher";
import { useShellSlots, useShellWorld } from "./ShellContext";

const BRAND_LABEL = "UWE Studio";
const BRAND_HREF = "/worlds";

/**
 * Der Studio-Shell. Einer, für alle Routen.
 *
 * Vorher gab es zwei: `StudioShell` für den welt-losen Zustand und `WorldShell`
 * für den Welt-Kontext, und jede Seite entschied selbst, welchen sie aufmacht.
 * Die beiden Seitenleisten ersetzten einander vollständig — in einer Welt war
 * die globale IA (Suche, Brain, KI, Jobs, Admin) verschwunden, außerhalb die
 * Welt. Der Weltwechsel *war* der Shell-Wechsel.
 *
 * Jetzt sitzt der Shell im Root-Layout und die Welt ist Zustand statt Rahmen:
 * die Seitenleiste trägt immer den globalen Block und, solange eine Welt aktiv
 * ist, darüber den Welt-Block mit dem Switcher im Kopf. Keine Route rendert
 * noch eigene Navigation; Brotkrumen und Kontextspalte melden die Seiten über
 * `ShellBreadcrumb` / `ShellContextPanel` an (siehe ShellContext.tsx).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { activeWorld } = useShellWorld();
  const { breadcrumb, contextPanel } = useShellSlots();
  const urls = useClientAppUrls();

  const liveSessionId = liveSessionIdFromPathname(pathname);

  const worldGroups = React.useMemo(() => {
    if (!activeWorld) return null;
    // Am Spieltisch schrumpft der Welt-Block auf die vier Live-Ziele. Das war
    // früher `navMode="live"` — eine Prop, die genau eine Seite gesetzt hat.
    // Der Shell liest es jetzt selbst aus dem Pfad, sonst müsste die Seite
    // wieder etwas über ihren eigenen Rahmen wissen.
    return liveSessionId
      ? worldLiveNav(activeWorld.slug, liveSessionId, pathname)
      : worldSidebar(activeWorld.slug, pathname);
  }, [activeWorld, liveSessionId, pathname]);

  const blocks = React.useMemo<SidebarBlock[]>(() => {
    const list: SidebarBlock[] = [];
    if (activeWorld && worldGroups) {
      list.push({
        id: "world",
        label: liveSessionId ? `Live · ${activeWorld.name}` : activeWorld.name,
        groups: worldGroups,
      });
    }
    list.push({ id: "studio", label: "Studio", groups: studioSidebar(pathname) });
    return list;
  }, [activeWorld, liveSessionId, pathname, worldGroups]);

  // Die Suchleiste findet immer die gesamte Studio-IA — auch aus einer Welt
  // heraus, wo die Welt-Befehle nur die Welt-Navigation enthalten. Die
  // Reihenfolge stellt den aktuellen Kontext voran, das Dedupe verhindert
  // Doppelungen.
  const searchEntries = React.useMemo(
    () =>
      dedupeNavSearchEntries([
        ...(activeWorld ? worldCommands(activeWorld.slug) : []),
        ...studioCommands(),
      ]),
    [activeWorld],
  );

  const bottomNav = React.useMemo(
    () =>
      // Handoff, Abschnitt „5 · Mobil": die Bottom-Nav schaltet zwischen den
      // Produkten, nicht innerhalb einer App. Sie hing früher nur am
      // StudioShell — auf dem Telefon war der Wechsel nach Portal/Brain/Family
      // aus einer Welt heraus deshalb gar nicht erreichbar.
      crossAppBottomNavItems({
        active: "studio",
        startUrl: urls.start,
        studioUrl: urls.studio,
        portalUrl: urls.portal,
        brainUrl: urls.brain,
        familyUrl: urls.family,
      }),
    [urls],
  );

  const trail = breadcrumb ?? deriveShellBreadcrumb(pathname, activeWorld);

  return (
    <SidebarContextProvider closeSidebar={() => undefined}>
      <div
        className="flex h-dvh w-full overflow-hidden bg-background text-foreground"
        data-has-bottom-nav="true"
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
          <SidebarBrand />
          <WorldSwitcher />
          <ScrollArea variant="sidebar" className="min-h-0 flex-1">
            <SidebarNav blocks={blocks} />
          </ScrollArea>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-14 items-center gap-3 border-b border-border pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)]">
            <MobileNav blocks={blocks} />
            <div className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:block">
              <BreadcrumbTrail items={trail} />
            </div>
            <NavSearch
              entries={searchEntries}
              className="min-w-0 flex-1 sm:max-w-64 lg:max-w-80"
              placeholder="Bereich suchen… (z. B. KI)"
              renderIcon={(hit) => <NavIcon name={hit.icon ?? "arrow-right"} width={16} height={16} />}
            />
            <div id="uwe-topbar-end" className="flex shrink-0 items-center gap-2" />
            <ThemeModeToggle />
            <CommandHint />
          </header>

          <div className="flex min-h-0 flex-1">
            <main
              id="uwe-main"
              // Ohne tabIndex springt der Fokus beim Klick auf die Sprungmarke
              // zwar an die Stelle, landet aber auf keinem Element — die
              // nächste Tab-Taste führte zurück in die Navigation.
              tabIndex={-1}
              className="min-w-0 flex-1 overflow-y-auto p-4 studio-main-with-bottom-nav md:p-6"
            >
              {children}
            </main>
            {contextPanel ? (
              <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border p-4 lg:block">
                {contextPanel}
              </aside>
            ) : null}
          </div>

          <div className="md:hidden">
            <MobileBottomNav items={bottomNav} />
          </div>
        </div>

        {/*
         * The Cmd/Ctrl+K palette is intentionally NOT mounted here. It lives once
         * globally in app/layout.tsx (StudioCommandPalette) so a single listener and
         * a single palette serve the whole app.
         */}
      </div>
    </SidebarContextProvider>
  );
}

function SidebarBrand() {
  return (
    <Link
      href={BRAND_HREF}
      // Ohne explizite Farbe greift die globale `a`-Regel aus uwe.css und
      // färbt den Link mit --uwe-link. Auf der immer dunklen Sidebar sind das
      // 2.15:1 — der Markenname war praktisch unlesbar. Die Überschreibung in
      // ghibli-shell.css hängt an `.uwe-sidebar`; dieser Shell baut die
      // Seitenleiste aber mit `bg-sidebar` und wird davon nicht erfasst.
      className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 font-semibold text-sidebar-foreground no-underline"
    >
      {BRAND_LABEL}
    </Link>
  );
}

function MobileNav({ blocks }: { blocks: SidebarBlock[] }) {
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
      <SheetContent side="left" title={BRAND_LABEL} className="uwe-sidebar-surface">
        <div className="mb-2 px-2 font-semibold">{BRAND_LABEL}</div>
        {/*
          Der Switcher steht außerhalb des SheetClose: ein Klick darauf öffnet
          ein Menü, er ist kein Navigationsziel. Innerhalb würde die Schublade
          zuklappen, bevor das Menü überhaupt aufgeht.
        */}
        <WorldSwitcher />
        <ScrollArea variant="sidebar" className="min-h-0 flex-1">
          <SheetClose asChild>
            <div>
              <SidebarNav blocks={blocks} />
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
