"use client";

import type { ReactNode } from "react";
import { SearchField } from "../AppShell";
import type { BottomNavItem } from "../MobileComponents";
import { StudioCockpitTopBar, type StudioCockpitWorldOption } from "../shells/StudioCockpitTopBar";
import { AppShellV2, V2PageHeader, V2TopBarBrand } from "./AppShellV2";
import { V2_NAV_ICONS } from "./icons";

export type StudioShellV2Variant = "cockpit" | "module" | "world" | "dashboard";

export interface StudioShellV2Props {
  main: ReactNode;
  sidebar?: ReactNode;
  context?: ReactNode;
  contextTitle?: string;
  subtitle?: string;
  brandHref?: string;
  topBarExtra?: ReactNode;
  showSearch?: boolean;
  searchAction?: string;
  searchPlaceholder?: string;
  bottomNav?: BottomNavItem[];
  showRail?: boolean;
  railActiveId?: string;
  cockpitMode?: boolean;
  cockpitWorlds?: StudioCockpitWorldOption[];
  activeWorldSlug?: string | null;
  statusFooter?: ReactNode;
  pageHeader?: {
    title: string;
    summary?: string | null;
    meta?: ReactNode;
    actions?: ReactNode;
  };
  variant?: StudioShellV2Variant;
}

const RAIL_ITEMS = [
  { id: "today", href: "/today", label: "Heute", icon: V2_NAV_ICONS.today },
  { id: "worlds", href: "/worlds", label: "Welten", icon: V2_NAV_ICONS.search },
  { id: "create", href: "/capture", label: "Erstellen", icon: V2_NAV_ICONS.capture },
  { id: "media-ai", href: "/ai", label: "Medien & KI", icon: V2_NAV_ICONS.ai },
  { id: "system", href: "/system", label: "System", icon: V2_NAV_ICONS.menu },
] as const;

function StudioIconRailV2({ activeId }: { activeId?: string }) {
  return (
    <nav aria-label="Schnellzugriff">
      {RAIL_ITEMS.map((item) => (
        <a
          key={item.id}
          href={item.href}
          className={`uwe-v2-rail-link${activeId === item.id ? " active" : ""}`}
          aria-label={item.label}
          title={item.label}
        >
          {item.icon}
        </a>
      ))}
    </nav>
  );
}

function resolveSubtitle(variant: StudioShellV2Variant, subtitle?: string) {
  if (subtitle) return subtitle;
  switch (variant) {
    case "world":
      return "Welt bearbeiten";
    case "dashboard":
      return "Dashboard";
    default:
      return "UWE Studio";
  }
}

/** Design V2 Studio shell — icon rail, sidebar sections, topbar, main, context. */
export function StudioShellV2({
  main,
  sidebar,
  context,
  contextTitle,
  subtitle,
  brandHref = "/today",
  topBarExtra,
  showSearch = false,
  searchAction = "/search",
  searchPlaceholder = "Global suchen…",
  bottomNav,
  showRail = false,
  railActiveId,
  cockpitMode = false,
  cockpitWorlds = [],
  activeWorldSlug,
  statusFooter,
  pageHeader,
  variant = "module",
}: StudioShellV2Props) {
  const resolvedSubtitle = resolveSubtitle(variant, subtitle);
  const body = (
    <>
      {pageHeader ? (
        <V2PageHeader
          title={pageHeader.title}
          summary={pageHeader.summary}
          meta={pageHeader.meta}
          actions={pageHeader.actions}
        />
      ) : null}
      {main}
    </>
  );

  const searchSlot = showSearch ? (
    <SearchField action={searchAction} placeholder={searchPlaceholder} />
  ) : null;

  const topBar = cockpitMode ? (
    <StudioCockpitTopBar
      worlds={cockpitWorlds}
      activeWorldSlug={activeWorldSlug}
      brandHref={brandHref}
      searchSlot={searchSlot}
      endSlot={topBarExtra}
    />
  ) : (
    <>
      <V2TopBarBrand appName="UWE Studio" subtitle={resolvedSubtitle} href={brandHref} />
      {searchSlot}
      {topBarExtra}
    </>
  );

  return (
    <AppShellV2
      rail={showRail ? <StudioIconRailV2 activeId={railActiveId} /> : undefined}
      bottomNav={bottomNav}
      contextTitle={contextTitle}
      statusFooter={statusFooter}
      topBar={topBar}
      sidebar={sidebar}
      context={context}
      main={body}
    />
  );
}

export interface StudioNavSidebarV2Props {
  title?: string;
  items: { label: string; href: string; active?: boolean; badge?: string }[];
  footer?: ReactNode;
}

export function StudioNavSidebarV2({
  title = "Navigation",
  items,
  footer,
}: StudioNavSidebarV2Props) {
  return (
    <>
      <section className="uwe-sidebar-section">
        <h3>{title}</h3>
        <nav className="uwe-sidebar-nav" aria-label="Seitennavigation">
          <ul>
            {items.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className={item.active ? "active" : undefined}
                  aria-current={item.active ? "page" : undefined}
                >
                  {item.label}
                  {item.badge ? <span className="uwe-badge">{item.badge}</span> : null}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </section>
      {footer}
    </>
  );
}
