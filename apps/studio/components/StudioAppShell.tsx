import type { ReactNode } from "react";
import {
  AdminShell,
  NavSidebarSections,
  SidebarNav,
  SidebarSection,
  StudioNavSidebar,
  StudioShell,
  type BottomNavItem,
} from "@uwe/shared-ui";
import { globalNavItems } from "@/src/lib/global-nav";
import { studioWorldBottomNav } from "@/src/lib/mobile-nav";
import {
  studioDashboardNav,
  studioSidebarSections,
  resolveStudioRailActiveId,
  worldBottomNavKey,
  worldNavItems,
  type WorldBottomNavKey,
  type WorldNavKey,
} from "@/src/lib/studio-navigation";

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
}

/** Unified Studio shell with sectioned navigation. */
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
}: StudioAppShellProps) {
  const railActiveId = railActiveIdProp ?? resolveStudioRailActiveId(activePath);
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
      <StudioShell
        subtitle="Welt bearbeiten"
        brandHref={`/worlds/${worldSlug}/dashboard`}
        showSearch={showSearch}
        searchAction={`/worlds/${worldSlug}?q=`}
        searchPlaceholder="In dieser Welt suchen…"
        bottomNav={bottomNav ?? studioWorldBottomNav(worldSlug, bottomKey)}
        context={context}
        contextTitle={contextTitle}
        pageHeader={
          title
            ? {
                title,
                summary,
                actions,
              }
            : undefined
        }
        sidebar={
          <>
            <SidebarSection title="Global">
              <SidebarNav items={globalNavItems()} />
            </SidebarSection>
            <StudioNavSidebar title="Welt" items={navItems} />
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
        showRail={showRail}
        railActiveId={railActiveId}
        showSearch={showSearch}
        bottomNav={bottomNav}
        context={context}
        contextTitle={contextTitle}
        pageHeader={
          title
            ? {
                title,
                summary,
                actions,
              }
            : undefined
        }
        sidebar={
          <StudioNavSidebar
            title="Studio"
            items={studioDashboardNav(activePath)}
          />
        }
        main={headerBlock}
      />
    );
  }

  if (variant === "admin") {
    return (
      <AdminShell
        activePath={activePath}
        navItems={studioSidebarSections(activePath).flatMap((section) => section.items)}
        title={title ?? "Admin"}
        summary={summary ?? ""}
        actions={actions}
        bottomNav={bottomNav}
        main={headerBlock}
      />
    );
  }

  return (
    <StudioShell
      showRail={showRail}
      railActiveId={railActiveId}
      showSearch={showSearch}
      bottomNav={bottomNav}
      context={context}
      contextTitle={contextTitle}
      pageHeader={
        title
          ? {
              title,
              summary,
              actions,
            }
          : undefined
      }
      sidebar={
        <NavSidebarSections
          sections={studioSidebarSections(activePath)}
          defaultOpenTitles={["Dashboard", "Inhalte & Medien", "Einstellungen"]}
        />
      }
      main={headerBlock}
    />
  );
}
