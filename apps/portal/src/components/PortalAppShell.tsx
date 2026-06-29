"use client";

import type { ReactNode } from "react";
import {
  NavSidebarSections,
  PortalShellV2,
  type BottomNavItem,
} from "@uwe/shared-ui";
import {
  portalAuthSidebarSections,
  type PortalAccountNavKey,
  type PortalGlobalNavKey,
  type PortalWorldNavKey,
} from "@/src/lib/portal-navigation";
import { LogoutButton } from "./LogoutButton";

export interface PortalAppShellProps {
  children: ReactNode;
  user?: {
    displayName: string;
    email: string | null;
  } | null;
  worldSlug?: string | null;
  worldName?: string;
  globalActive?: PortalGlobalNavKey;
  worldActive?: PortalWorldNavKey;
  accountActive?: PortalAccountNavKey;
  bottomNav?: BottomNavItem[];
  pageHeader?: {
    title: string;
    summary?: string | null;
    meta?: ReactNode;
    actions?: ReactNode;
  };
  breadcrumbs?: { label: string; href?: string }[];
  backHref?: string;
  backLabel?: string;
  studioUrl?: string | null;
  canAccessStudio?: boolean;
}

/** Player-facing Portal shell with consistent navigation — pending C1/C2 migration to AppShell PortalShell. */
export function PortalAppShell({
  children,
  user,
  worldSlug = null,
  worldName,
  globalActive = "worlds",
  worldActive,
  accountActive,
  bottomNav,
  pageHeader,
  breadcrumbs,
  backHref,
  backLabel,
  studioUrl,
  canAccessStudio = false,
}: PortalAppShellProps) {
  const sections = portalAuthSidebarSections({
    globalActive,
    worldSlug,
    worldActive,
    accountActive,
    includeAccount: accountActive !== undefined,
  });

  const topBarExtra = (
    <div className="portal-topbar-actions">
      {canAccessStudio && studioUrl ? (
        <a href={studioUrl} className="portal-studio-link">
          Studio öffnen
        </a>
      ) : null}
      {user ? (
        <LogoutButton displayName={user.displayName} />
      ) : (
        <a href="/login" className="portal-login-link">
          Anmelden
        </a>
      )}
    </div>
  );

  const main = (
    <>
      {backHref ? (
        <a href={backHref} className="uwe-back-link">
          ← {backLabel ?? "Zurück"}
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
      {pageHeader ? (
        <header className="uwe-page-header">
          <div className="uwe-page-header-main">
            <h1>{pageHeader.title}</h1>
            {pageHeader.summary ? (
              <p className="uwe-page-summary">{pageHeader.summary}</p>
            ) : null}
            {pageHeader.meta ? <div className="uwe-page-meta">{pageHeader.meta}</div> : null}
          </div>
          {pageHeader.actions ? (
            <div className="uwe-page-actions">{pageHeader.actions}</div>
          ) : null}
        </header>
      ) : null}
      <div className="portal-app-content">{children}</div>
    </>
  );

  return (
    <PortalShellV2
      worldName={worldName}
      brandHref="/auth/worlds"
      topBarExtra={topBarExtra}
      bottomNav={bottomNav}
      contextTitle="Navigation"
      sidebar={<NavSidebarSections sections={sections} />}
      main={main}
    />
  );
}
