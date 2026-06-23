import type { ReactNode } from "react";
import {
  AppShell,
  PageHeader,
  SearchField,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "../AppShell";
import type { BottomNavItem } from "../MobileComponents";
import { StudioCockpitTopBar, type StudioCockpitWorldOption } from "./StudioCockpitTopBar";
import { StudioIconRail } from "./studio-rail";

export type StudioBottomNavKey = "today" | "capture" | "search" | "ai" | "more";

export interface StudioShellProps {
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
  /** Cockpit chrome: world switcher, ⌘K hint, status footer slot */
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
}

/** DM cockpit shell — dense navigation, optional icon rail, Studio chrome. */
export function StudioShell({
  main,
  sidebar,
  context,
  contextTitle,
  subtitle = "UWE Studio",
  brandHref = "/studio",
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
}: StudioShellProps) {
  const body = (
    <>
      {pageHeader && (
        <PageHeader
          title={pageHeader.title}
          summary={pageHeader.summary}
          meta={pageHeader.meta}
          actions={pageHeader.actions}
        />
      )}
      {main}
    </>
  );

  const searchSlot =
    showSearch && !cockpitMode ? (
      <SearchField action={searchAction} placeholder={searchPlaceholder} />
    ) : showSearch && cockpitMode ? (
      <SearchField
        action={searchAction}
        placeholder={searchPlaceholder}
      />
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
      <TopBarBrand appName="UWE Studio" subtitle={subtitle} href={brandHref} />
      {searchSlot}
      {topBarExtra}
    </>
  );

  return (
    <AppShell
      rail={showRail ? <StudioIconRail activeId={railActiveId} /> : undefined}
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

export interface StudioNavSidebarProps {
  title?: string;
  items: { label: string; href: string; active?: boolean; badge?: string }[];
  footer?: ReactNode;
}

export function StudioNavSidebar({
  title = "Navigation",
  items,
  footer,
}: StudioNavSidebarProps) {
  return (
    <>
      <SidebarSection title={title}>
        <SidebarNav items={items} />
      </SidebarSection>
      {footer}
    </>
  );
}
