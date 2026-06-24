"use client";

import type { ReactNode } from "react";
import {
  isDesignV2Enabled,
  NavSidebarSections,
  PortalShell,
  PortalShellV2,
  type BottomNavItem,
} from "@uwe/shared-ui";
import {
  portalPublicSidebarSections,
  type PortalNavItem,
  type PortalPublicNavKey,
} from "@/src/lib/portal-navigation";

export interface PortalPublicShellProps {
  children: ReactNode;
  worldName?: string;
  worldSlug?: string | null;
  publicActive?: PortalPublicNavKey;
  worldSidebarItems?: PortalNavItem[];
  /** Custom sidebar content (e.g. grouped wiki nav). Overrides default sections. */
  sidebar?: ReactNode;
  bottomNav?: BottomNavItem[];
  topBarExtra?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  backHref?: string;
  backLabel?: string;
  brandHref?: string;
}

/** Read-only public wiki shell — calm player-facing chrome. */
export function PortalPublicShell({
  children,
  worldName,
  worldSlug = null,
  publicActive = "discover",
  worldSidebarItems,
  sidebar,
  bottomNav,
  topBarExtra,
  breadcrumbs,
  backHref,
  backLabel,
  brandHref,
}: PortalPublicShellProps) {
  const sections = portalPublicSidebarSections({
    active: publicActive,
    worldSlug,
    worldItems: worldSidebarItems,
  });

  const resolvedBrandHref = brandHref ?? (worldSlug ? `/worlds/${worldSlug}` : "/worlds");

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
      <div className="portal-app-content">{children}</div>
    </>
  );

  return isDesignV2Enabled() ? (
    <PortalShellV2
      worldName={worldName}
      brandHref={resolvedBrandHref}
      topBarExtra={topBarExtra}
      bottomNav={bottomNav}
      contextTitle="Navigation"
      sidebar={sidebar ?? <NavSidebarSections sections={sections} />}
      main={main}
    />
  ) : (
    <PortalShell
      worldName={worldName}
      brandHref={resolvedBrandHref}
      topBarExtra={topBarExtra}
      bottomNav={bottomNav}
      contextTitle="Navigation"
      sidebar={sidebar ?? <NavSidebarSections sections={sections} />}
      main={main}
    />
  );
}
