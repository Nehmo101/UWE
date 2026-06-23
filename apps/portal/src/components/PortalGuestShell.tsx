/** Guest / public Portal shell — calm read-only chrome without admin noise. */

import type { ReactNode } from "react";
import {
  PortalNavSidebar,
  PortalShell,
  SidebarNav,
  type BottomNavItem,
} from "@uwe/shared-ui";
import { portalGuestNav } from "@/src/lib/portal-navigation";

export interface PortalGuestShellProps {
  children: ReactNode;
  worldName?: string;
  brandHref?: string;
  brandAppName?: string;
  bottomNav?: BottomNavItem[];
  sidebar?: ReactNode;
  pageHeader?: {
    title: string;
    summary?: string | null;
    meta?: ReactNode;
    actions?: ReactNode;
  };
  breadcrumbs?: { label: string; href?: string }[];
  backHref?: string;
  backLabel?: string;
  topBarExtra?: ReactNode;
  guestNavActive?: string;
  showLoginLink?: boolean;
  context?: ReactNode;
  contextTitle?: string;
}

export function PortalGuestShell({
  children,
  worldName,
  brandHref = "/",
  brandAppName = "UWE Portal",
  bottomNav,
  sidebar,
  pageHeader,
  breadcrumbs,
  backHref,
  backLabel = "Zurück",
  topBarExtra,
  guestNavActive,
  showLoginLink = true,
  context,
  contextTitle,
}: PortalGuestShellProps) {
  const main = (
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
      <div className="portal-app-content">{children}</div>
    </>
  );

  return (
    <PortalShell
      appName={brandAppName}
      worldName={worldName}
      brandHref={brandHref}
      bottomNav={bottomNav}
      context={context}
      contextTitle={contextTitle}
      pageHeader={pageHeader}
      topBarExtra={
        <div className="portal-topbar-actions">
          {topBarExtra}
          {showLoginLink ? (
            <a href="/login" className="portal-login-link">
              Anmelden
            </a>
          ) : null}
        </div>
      }
      sidebar={
        sidebar ?? (
          <PortalNavSidebar>
            <SidebarNav items={portalGuestNav(guestNavActive)} />
          </PortalNavSidebar>
        )
      }
      main={main}
    />
  );
}
