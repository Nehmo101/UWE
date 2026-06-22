import type { ReactNode } from "react";
import { AppShell, PageHeader, SidebarSection, TopBarBrand } from "../AppShell";
import type { BottomNavItem } from "../MobileComponents";

export interface PortalShellProps {
  main: ReactNode;
  sidebar?: ReactNode;
  worldName?: string;
  brandHref?: string;
  topBarExtra?: ReactNode;
  bottomNav?: BottomNavItem[];
  contextTitle?: string;
  pageHeader?: {
    title: string;
    summary?: string | null;
    meta?: ReactNode;
    actions?: ReactNode;
  };
}

/** Calm player-facing shell — simpler chrome than Studio. */
export function PortalShell({
  main,
  sidebar,
  worldName,
  brandHref = "/",
  topBarExtra,
  bottomNav,
  contextTitle = "Navigation",
  pageHeader,
}: PortalShellProps) {
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

  return (
    <AppShell
      bottomNav={bottomNav}
      contextTitle={contextTitle}
      topBar={
        <>
          <TopBarBrand
            appName="UWE Portal"
            subtitle={worldName}
            href={brandHref}
          />
          {topBarExtra}
        </>
      }
      sidebar={sidebar}
      main={body}
    />
  );
}

export function PortalNavSidebar({
  title = "Navigation",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return <SidebarSection title={title}>{children}</SidebarSection>;
}
