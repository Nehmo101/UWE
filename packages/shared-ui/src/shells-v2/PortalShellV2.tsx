import type { ReactNode } from "react";
import type { BottomNavItem } from "../MobileComponents";
import { AppShellV2, V2PageHeader, V2TopBarBrand } from "./AppShellV2";

export interface PortalShellV2Props {
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

/** Design V2 player shell — minimal topbar, world nav sidebar, reader canvas, mobile bottom nav. */
export function PortalShellV2({
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
}: PortalShellV2Props) {
  const body = (
    <>
      {pageHeader ? (
        <V2PageHeader
          title={pageHeader.title}
          summary={pageHeader.summary}
          meta={pageHeader.meta}
          actions={pageHeader.actions}
        />
      ) : null}
      <div className="portal-app-content portal-reader-canvas">{main}</div>
    </>
  );

  return (
    <AppShellV2
      bottomNav={bottomNav}
      contextTitle={contextTitle}
      topBar={
        <>
          <V2TopBarBrand appName={appName} subtitle={worldName} href={brandHref} />
          {topBarExtra}
        </>
      }
      sidebar={sidebar}
      context={context}
      main={body}
    />
  );
}

export function PortalNavSidebarV2({
  title = "Navigation",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="uwe-sidebar-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
