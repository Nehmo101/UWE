import type { ReactNode } from "react";
import { AppShell, PageHeader, SidebarSection, TopBarBrand } from "../AppShell";
import type { BottomNavItem } from "../MobileComponents";

export interface PortalShellProps {
  main: ReactNode;
  sidebar?: ReactNode;
  context?: ReactNode;
  contextTitle?: string;
  worldName?: string;
  appName?: string;
  brandHref?: string;
  topBarExtra?: ReactNode;
  bottomNav?: BottomNavItem[];
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
  context,
  contextTitle = "Navigation",
  worldName,
  appName = "UWE Portal",
  brandHref = "/",
  topBarExtra,
  bottomNav,
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
            appName={appName}
            subtitle={worldName}
            href={brandHref}
          />
          {topBarExtra}
        </>
      }
      sidebar={sidebar}
      context={context}
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
