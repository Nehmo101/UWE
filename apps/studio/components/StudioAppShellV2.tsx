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
  type WorldNavSection,
} from "@/src/lib/studio-navigation";

export type StudioAppShellV2Variant = "dashboard" | "admin" | "world" | "module";

export interface StudioAppShellV2Props {
  variant?: StudioAppShellV2Variant;
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
  sidebar?: ReactNode;
  cockpitMode?: boolean;
  cockpitWorlds?: { name: string; slug: string }[];
  statusFooter?: ReactNode;
  unifiedSidebar?: boolean;
}

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

/** Studio shell V2 — canonical Studio/World shell adapter with Design V2 chrome. */
export function StudioAppShellV2({
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
}: StudioAppShellV2Props) {
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
    <>
      {backHref ? (
        <a href={backHref} className="uwe-back-link">
          ← {backLabel}
        </a>
      ) : null}
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav className="uwe-breadcrumb" aria-label="Brotkrumen">
          {breadcrumbs.map((item, index) => (
            <span key={`${item.label}-${index}`}>
              {item.href ? <a href={item.href}>{item.label}</a> : item.label}
              {index < breadcrumbs.length - 1 ? (
                <span className="uwe-breadcrumb-sep">/</span>
              ) : null}
            </span>
          ))}
        </nav>
      ) : null}
      {children}
    </>
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
