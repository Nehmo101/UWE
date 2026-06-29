import type { ReactNode } from "react";
import {
  AdminShellV2,
  NavSidebarSections,
  StudioNavSidebarV2,
  StudioShellV2,
  type BottomNavItem,
} from "@uwe/shared-ui";
import { studioWorldBottomNav } from "@/src/lib/mobile-nav";
import {
  studioDashboardNav,
  studioSidebarSections,
  studioUnifiedSidebarSections,
  resolveStudioRailActiveId,
  worldBottomNavKey,
  worldNavSections,
  type WorldBottomNavKey,
  type WorldNavKey,
} from "@/src/lib/studio-navigation";
import {
  applyCampaignToWorldSections,
  ShellHeaderBlock,
  worldDefaultOpenTitles,
} from "@/src/lib/studio-shell-utils";

export type StudioAppShellVariant = "dashboard" | "admin" | "world" | "module";

export interface StudioAppShellProps {
  variant?: StudioAppShellVariant;
  activePath: string;
  children: ReactNode;
  title?: string;
  summary?: string;
  actions?: ReactNode;
  bottomNav?: BottomNavItem[];
  showRail?: boolean;
  railActiveId?: string;
  showSearch?: boolean;
  worldSlug?: string;
  worldActive?: WorldNavKey;
  /** Preserve campaign filter on „Neue Seite“ link. */
  campaignSlug?: string;
  searchQuery?: string;
  bottomNavActive?: WorldBottomNavKey;
  sidebarExtra?: ReactNode;
  context?: ReactNode;
  contextTitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  backHref?: string;
  backLabel?: string;
  topBarExtra?: ReactNode;
  searchAction?: string;
  searchPlaceholder?: string;
  /** When set, replaces the default sectioned sidebar. */
  sidebar?: ReactNode;
  /** Cockpit mockup chrome — world switcher, ⌘K hint, status footer */
  cockpitMode?: boolean;
  cockpitWorlds?: { name: string; slug: string }[];
  statusFooter?: ReactNode;
  /** Use the reduced canonical Studio IA sidebar. */
  unifiedSidebar?: boolean;
}

/** Studio shell adapter with Design V2 chrome — pending C1/C2 migration to SettingsShell/SystemShell. */
export function StudioAppShell({
  variant = "module",
  activePath,
  children,
  title,
  summary,
  actions,
  bottomNav,
  showRail = true,
  railActiveId: railActiveIdProp,
  showSearch = false,
  worldSlug,
  worldActive,
  campaignSlug,
  searchQuery = "",
  bottomNavActive,
  sidebarExtra,
  context,
  contextTitle,
  breadcrumbs,
  backHref,
  backLabel = "Zurück",
  topBarExtra,
  searchAction = "/search",
  searchPlaceholder = "Global suchen…",
  sidebar: sidebarOverride,
  cockpitMode = false,
  cockpitWorlds = [],
  statusFooter,
  unifiedSidebar = true,
}: StudioAppShellProps) {
  const railActiveId = railActiveIdProp ?? resolveStudioRailActiveId(activePath);
  const sidebarSections = unifiedSidebar
    ? studioUnifiedSidebarSections(activePath)
    : studioSidebarSections(activePath);

  const shellVariant =
    variant === "world" ? "world" : variant === "dashboard" ? "dashboard" : cockpitMode ? "cockpit" : "module";

  const shellCommon = {
    variant: shellVariant as "cockpit" | "module" | "world" | "dashboard",
    cockpitMode,
    cockpitWorlds,
    activeWorldSlug: worldSlug ?? null,
    statusFooter,
    showRail,
    railActiveId,
    showSearch,
    searchAction,
    searchPlaceholder,
    topBarExtra,
    bottomNav,
    context,
    contextTitle,
  };

  const headerBlock = (
    <ShellHeaderBlock backHref={backHref} backLabel={backLabel} breadcrumbs={breadcrumbs}>
      {children}
    </ShellHeaderBlock>
  );

  const pageHeader = title
    ? {
        title,
        summary,
        actions,
      }
    : undefined;

  if (variant === "world" && worldSlug) {
    const bottomKey =
      bottomNavActive ?? worldBottomNavKey(worldActive ?? "overview", Boolean(searchQuery?.trim()));
    const worldSections = applyCampaignToWorldSections(
      worldNavSections(worldSlug, worldActive),
      campaignSlug,
    );

    return (
      <StudioShellV2
        {...shellCommon}
        variant="world"
        brandHref={`/worlds/${worldSlug}/dashboard`}
        searchAction={`/worlds/${worldSlug}?q=`}
        searchPlaceholder="In dieser Welt suchen…"
        bottomNav={bottomNav ?? studioWorldBottomNav(worldSlug, bottomKey)}
        pageHeader={pageHeader}
        sidebar={
          <>
            <NavSidebarSections sections={sidebarSections} defaultOpenTitles={["Welten"]} />
            <NavSidebarSections
              sections={worldSections}
              defaultOpenTitles={worldDefaultOpenTitles(worldSections)}
            />
            {sidebarExtra}
          </>
        }
        main={headerBlock}
      />
    );
  }

  if (variant === "dashboard") {
    return (
      <StudioShellV2
        {...shellCommon}
        variant="dashboard"
        pageHeader={pageHeader}
        sidebar={
          unifiedSidebar ? (
            <NavSidebarSections sections={sidebarSections} defaultOpenTitles={["Heute", "Welten"]} />
          ) : (
            <StudioNavSidebarV2 title="Studio" items={studioDashboardNav(activePath)} />
          )
        }
        main={headerBlock}
      />
    );
  }

  if (variant === "admin") {
    return (
      <AdminShellV2
        activePath={activePath}
        navItems={sidebarSections.flatMap((section) => section.items)}
        title={title ?? "System"}
        summary={summary ?? ""}
        actions={actions}
        bottomNav={bottomNav}
        main={headerBlock}
      />
    );
  }

  return (
    <StudioShellV2
      {...shellCommon}
      variant="module"
      pageHeader={pageHeader}
      sidebar={
        sidebarOverride ?? (
          <NavSidebarSections sections={sidebarSections} defaultOpenTitles={["Heute", "Welten"]} />
        )
      }
      main={headerBlock}
    />
  );
}
