import {
  BackLink,
  Breadcrumb,
  GlobalSearchForm,
  isDesignV2Enabled,
  NavSidebarSections,
  SidebarNav,
  SidebarSection,
  StudioShell,
  StudioShellV2,
} from "@uwe/shared-ui";
import { studioWorldBottomNav } from "@/src/lib/mobile-nav";
import {
  resolveStudioRailActiveId,
  studioSidebarSections,
  studioUnifiedSidebarSections,
} from "@/src/lib/studio-navigation";
import {
  worldBottomNavKey,
  worldNavSections,
  type WorldBottomNavKey,
  type WorldNavKey,
  type WorldNavSection,
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

export type WorldShellProps = WorldModuleShellProps;

function applyCampaignToWorldSections(
  sections: WorldNavSection[],
  campaignSlug?: string,
): WorldNavSection[] {
  if (!campaignSlug) return sections;
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.key === "new-page" ? { ...item, href: `${item.href}?campaign=${campaignSlug}` } : item,
    ),
  }));
}

function worldDefaultOpenTitles(sections: WorldNavSection[]) {
  const activeTitle = sections.find((section) => section.items.some((item) => item.active))?.title;
  return Array.from(new Set(["Übersicht", "Inhalte", activeTitle].filter(Boolean) as string[]));
}

/**
 * Stable world shell — sectioned Studio nav + grouped world cockpit navigation.
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
  const worldSections = applyCampaignToWorldSections(
    worldNavSections(worldSlug, activeNav),
    campaignSlug,
  );

  const sidebarSections = unifiedSidebar
    ? studioUnifiedSidebarSections(activePath)
    : studioSidebarSections(activePath);

  const sidebarContent = (
    <>
      <NavSidebarSections
        sections={sidebarSections}
        defaultOpenTitles={unifiedSidebar ? ["Welten"] : ["Welten"]}
      />
      <NavSidebarSections
        sections={worldSections}
        defaultOpenTitles={worldDefaultOpenTitles(worldSections)}
      />
      {sidebarExtra}
    </>
  );

  const mainContent = (
    <>
      {backLink && <BackLink href={backLink.href} label={backLink.label} />}
      {!hideBreadcrumb && <Breadcrumb items={breadcrumb} />}
      {children}
    </>
  );

  const shellProps = {
    subtitle: worldName,
    brandHref: `/worlds/${worldSlug}/dashboard`,
    showRail: true as const,
    railActiveId: resolveStudioRailActiveId(activePath),
    bottomNav: studioWorldBottomNav(worldSlug, bottomKey),
    contextTitle,
    context,
    cockpitMode,
    cockpitWorlds,
    activeWorldSlug: worldSlug,
    statusFooter,
    topBarExtra: cockpitMode ? (
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
    ),
    showSearch: cockpitMode ? showSearch : false,
    searchAction: activePath,
    searchPlaceholder: "In dieser Welt suchen…",
    pageHeader,
    sidebar: sidebarContent,
    main: mainContent,
  };

  if (isDesignV2Enabled()) {
    return <StudioShellV2 {...shellProps} variant="world" />;
  }

  return <StudioShell {...shellProps} />;
}

export const WorldShell = WorldModuleShell;

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
