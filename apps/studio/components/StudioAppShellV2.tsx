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
  worldNavItems,
  type WorldBottomNavKey,
  type WorldNavKey,
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

/** Studio shell V2 — mirrors StudioAppShell nav assembly with Design V2 chrome. */
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
    const navItems = worldNavItems(worldSlug, worldActive).map((item) => {
      if (item.key === "new-page" && campaignSlug) {
        return { ...item, href: `${item.href}?campaign=${campaignSlug}` };
      }
      return item;
    });

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
            <NavSidebarSections
              sections={sidebarSections}
              defaultOpenTitles={unifiedSidebar ? ["Portal", "Studio"] : ["Dashboard", "Welten & Kampagnen"]}
            />
            <StudioNavSidebarV2 title="Welt" items={navItems} />
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
            <NavSidebarSections sections={sidebarSections} defaultOpenTitles={["Portal", "Studio"]} />
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
        title={title ?? "Admin"}
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
          <NavSidebarSections
            sections={sidebarSections}
            defaultOpenTitles={
              unifiedSidebar
                ? ["Studio", "Bibliothek", "Administration"]
                : ["Dashboard", "Inhalte & Medien", "Einstellungen"]
            }
          />
        )
      }
      main={headerBlock}
    />
  );
}
