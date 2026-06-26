import type { ReactNode } from "react";
import {
  AdminShell,
  isDesignV2Enabled,
  NavSidebarSections,
  StudioNavSidebar,
  StudioShell,
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
import { StudioAppShellV2 } from "./StudioAppShellV2";

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

/**
 * Unified Studio shell with sectioned navigation.
 *
 * Legacy/fallback adapter: Design V2 is default-on, so this delegates to
 * `StudioAppShellV2` unless `NEXT_PUBLIC_UWE_DESIGN_V2=false`. Shared navigation
 * logic lives in `@/src/lib/studio-shell-utils` so V1/V2 cannot drift.
 */
export function StudioAppShell(props: StudioAppShellProps) {
  if (isDesignV2Enabled()) {
    return <StudioAppShellV2 {...props} />;
  }

  const {
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
  } = props;

  const railActiveId = railActiveIdProp ?? resolveStudioRailActiveId(activePath);
  const sidebarSections = unifiedSidebar
    ? studioUnifiedSidebarSections(activePath)
    : studioSidebarSections(activePath);

  const shellCommon = {
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
      <StudioShell
        {...shellCommon}
        subtitle="Welt bearbeiten"
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
      <StudioShell
        {...shellCommon}
        pageHeader={pageHeader}
        sidebar={
          unifiedSidebar ? (
            <NavSidebarSections sections={sidebarSections} defaultOpenTitles={["Heute", "Welten"]} />
          ) : (
            <StudioNavSidebar title="Studio" items={studioDashboardNav(activePath)} />
          )
        }
        main={headerBlock}
      />
    );
  }

  if (variant === "admin") {
    return (
      <AdminShell
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
    <StudioShell
      {...shellCommon}
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
