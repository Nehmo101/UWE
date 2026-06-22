import {
  AppShell,
  BackLink,
  Breadcrumb,
  GlobalSearchForm,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import { globalNavItems } from "@/src/lib/global-nav";
import { studioWorldBottomNav } from "@/src/lib/mobile-nav";
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
}

/**
 * Stable world shell — global nav + world nav always visible.
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
}: WorldModuleShellProps) {
  const bottomKey =
    bottomNavActive ?? worldBottomNavKey(activeNav, Boolean(searchQuery?.trim()));

  const navItems = worldNavItems(worldSlug, activeNav).map((item) => {
    if (item.key === "new-page" && campaignSlug) {
      return { ...item, href: `${item.href}?campaign=${campaignSlug}` };
    }
    return item;
  });

  return (
    <AppShell
      bottomNav={studioWorldBottomNav(worldSlug, bottomKey)}
      contextTitle={contextTitle}
      topBar={
        <>
          <TopBarBrand appName="UWE Studio" subtitle={worldName} href="/studio" />
          {showSearch && (
            <GlobalSearchForm
              action={`/worlds/${worldSlug}`}
              query={searchQuery}
              placeholder="In dieser Welt suchen…"
            />
          )}
          {topBarExtra}
        </>
      }
      sidebar={
        <>
          <SidebarSection title="Global">
            <SidebarNav items={globalNavItems()} />
          </SidebarSection>
          <SidebarSection title="Welt">
            <SidebarNav items={navItems} />
          </SidebarSection>
          {sidebarExtra}
        </>
      }
      main={
        <>
          {backLink && <BackLink href={backLink.href} label={backLink.label} />}
          <Breadcrumb items={breadcrumb} />
          {pageHeader && (
            <PageHeader
              title={pageHeader.title}
              summary={pageHeader.summary}
              meta={pageHeader.meta}
              actions={pageHeader.actions}
            />
          )}
          {children}
        </>
      }
      context={context}
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
