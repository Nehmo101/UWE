import {
  BackLink,
  Breadcrumb,
  GlobalSearchForm,
  NavSidebarSections,
  SidebarNav,
  SidebarSection,
  StudioNavSidebar,
  StudioShell,
} from "@uwe/shared-ui";
import { studioWorldBottomNav } from "@/src/lib/mobile-nav";
import {
  resolveStudioRailActiveId,
  studioSidebarSections,
  studioUnifiedSidebarSections,
} from "@/src/lib/studio-navigation";
import {
  worldBottomNavKey,
  worldNavItems,
  type WorldBottomNavKey,
  type WorldNavKey,
} from "@/src/lib/world-nav";
import type { ReactNode } from "react";

export interface WorldModuleShellProps {
  worldSlug: string;
  worldName: string;
  activeNav: WorldNavKey;
  breadcrumb: { label: string; href?: string }[];
  children: ReactNode;
  context?: ReactNode;
  contextTitle?: string;
  /** Additional sidebar sections below stable world nav (campaign filters, contextual links). */
  sidebarExtra?: ReactNode;
  topBarExtra?: ReactNode;
  pageHeader?: {
    title: string;
    summary?: string | null;
    meta?: ReactNode;
    actions?: ReactNode;
  };
  /** Logical back link shown above breadcrumbs on detail/editor pages. */
  backLink?: { label: string; href: string };
  searchQuery?: string;
  /** Preserve campaign filter on „Neue Seite“ link. */
  campaignSlug?: string;
  /** Override auto-detected mobile bottom nav tab. */
  bottomNavActive?: WorldBottomNavKey;
  showSearch?: boolean;
  /** Cockpit mockup chrome */
  cockpitMode?: boolean;
  cockpitWorlds?: { name: string; slug: string }[];
  statusFooter?: ReactNode;
  unifiedSidebar?: boolean;
  /** Hide breadcrumbs (e.g. world cockpit overview). */
  hideBreadcrumb?: boolean;
}

/**
 * Stable world shell — sectioned Studio nav + world nav always visible.
 * Context-specific links belong in sidebarExtra or page actions, not replacing main nav.
 */
export function WorldModuleShell({
  worldSlug,
  worldName,
  activeNav,
  breadcrumb,
  children,
  context,
  contextTitle = "Details & Kontext",
  sidebarExtra,
  topBarExtra,
  pageHeader,
  backLink,
  searchQuery = "",
  campaignSlug,
  bottomNavActive,
  showSearch = true,
  cockpitMode = false,
  cockpitWorlds = [],
  statusFooter,
  unifiedSidebar = true,
  hideBreadcrumb = false,
}: WorldModuleShellProps) {
  const bottomKey =
    bottomNavActive ?? worldBottomNavKey(activeNav, Boolean(searchQuery?.trim()));
  const activePath = `/worlds/${worldSlug}`;

  const navItems = worldNavItems(worldSlug, activeNav).map((item) => {
    if (item.key === "new-page" && campaignSlug) {
      return { ...item, href: `${item.href}?campaign=${campaignSlug}` };
    }
    return item;
  });

  const sidebarSections = unifiedSidebar
    ? studioUnifiedSidebarSections(activePath)
    : studioSidebarSections(activePath);

  return (
    <StudioShell
      subtitle={worldName}
      brandHref={`/worlds/${worldSlug}/dashboard`}
      showRail
      railActiveId={resolveStudioRailActiveId(activePath)}
      bottomNav={studioWorldBottomNav(worldSlug, bottomKey)}
      contextTitle={contextTitle}
      context={context}
      cockpitMode={cockpitMode}
      cockpitWorlds={cockpitWorlds}
      activeWorldSlug={worldSlug}
      statusFooter={statusFooter}
      topBarExtra={
        cockpitMode ? (
          topBarExtra
        ) : (
          <>
            {showSearch && (
              <GlobalSearchForm
                action={activePath}
                query={searchQuery}
                placeholder="In dieser Welt suchen…"
              />
            )}
            {topBarExtra}
          </>
        )
      }
      showSearch={cockpitMode ? showSearch : false}
      searchAction={activePath}
      searchPlaceholder="In dieser Welt suchen…"
      pageHeader={pageHeader}
      sidebar={
        <>
          <NavSidebarSections
            sections={sidebarSections}
            defaultOpenTitles={
              unifiedSidebar ? ["Portal", "Studio"] : ["Dashboard", "Welten & Kampagnen"]
            }
          />
          <StudioNavSidebar title="Welt" items={navItems} />
          {sidebarExtra}
        </>
      }
      main={
        <>
          {backLink && <BackLink href={backLink.href} label={backLink.label} />}
          {!hideBreadcrumb && <Breadcrumb items={breadcrumb} />}
          {children}
        </>
      }
    />
  );
}

/** Reusable campaign filter sidebar section. */
export function WorldCampaignSidebar({
  title = "Kampagnen",
  items,
}: {
  title?: string;
  items: { label: string; href: string; active?: boolean }[];
}) {
  return (
    <SidebarSection title={title}>
      <SidebarNav items={items} />
    </SidebarSection>
  );
}

/** Contextual sidebar section for detail/editor sub-navigation. */
export function WorldContextSidebar({
  title = "Kontext",
  items,
}: {
  title?: string;
  items: { label: string; href: string; active?: boolean }[];
}) {
  return (
    <SidebarSection title={title}>
      <SidebarNav items={items} />
    </SidebarSection>
  );
}
