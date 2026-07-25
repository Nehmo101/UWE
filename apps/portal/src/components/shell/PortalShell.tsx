"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { NavGroup } from "@uwe/shared-utils/navigation";
import { navGroupsToCommands, resolveNavGroups } from "@uwe/shared-utils/navigation";
import { PORTAL_NAV, portalWorldNav } from "../../navigation/portal-nav";
import { crossAppBottomNavItems, readClientAppUrls } from "@uwe/shared-ui";
import { AppShell } from "./AppShell";

export interface PortalShellProps {
  /** Optional active world to add world-scoped navigation. */
  worldSlug?: string | null;
  worldName?: string;
  /** Override sidebar brand label (default: worldName or "UWE Portal"). */
  brandLabel?: string;
  brandHref?: string;
  /** Override nav groups (e.g. guest/share with minimal nav). */
  navGroups?: NavGroup[];
  breadcrumb?: React.ReactNode;
  headerActions?: React.ReactNode;
  contextPanel?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Player-facing Portal shell — login-first IA, optional world scope.
 *
 * The mobile bottom nav is the default on every authenticated portal page
 * (rendered mobile-only via CSS); only custom `navGroups` overrides
 * (guest/share links) opt out of it.
 */
export function PortalShell({
  worldSlug,
  worldName,
  brandLabel,
  brandHref = "/auth/worlds",
  navGroups,
  breadcrumb,
  headerActions,
  contextPanel,
  footer,
  children,
}: PortalShellProps) {
  const pathname = usePathname() ?? "/auth/worlds";
  const sourceGroups =
    navGroups ?? (worldSlug ? [...PORTAL_NAV, ...portalWorldNav(worldSlug)] : PORTAL_NAV);
  const resolvedLabel = brandLabel ?? worldName ?? "UWE Portal";
  // Handoff, Abschnitt „5 · Mobil": die Bottom-Nav schaltet zwischen den
  // Produkten. Die Welt-/Portal-Navigation bleibt in der Schublade erreichbar.
  // Gast-/Share-Ansichten (eigene navGroups) bekommen keine Produktleiste.
  const urls = readClientAppUrls();
  const bottomNav = navGroups
    ? undefined
    : crossAppBottomNavItems({
        active: "portal",
        startUrl: urls.start,
        studioUrl: urls.studio,
        portalUrl: urls.portal,
        brainUrl: urls.brain,
      });

  return (
    <AppShell
      groups={resolveNavGroups(sourceGroups, pathname)}
      commands={navGroups ? [] : navGroupsToCommands(sourceGroups)}
      brandLabel={resolvedLabel}
      brandHref={brandHref}
      breadcrumb={breadcrumb}
      headerActions={headerActions}
      contextPanel={contextPanel}
      footer={footer}
      bottomNav={bottomNav}
    >
      {children}
    </AppShell>
  );
}
