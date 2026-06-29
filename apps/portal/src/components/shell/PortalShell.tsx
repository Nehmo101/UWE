"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { NavGroup } from "@uwe/shared-utils/navigation";
import { navGroupsToCommands, resolveNavGroups } from "@uwe/shared-utils/navigation";
import { PORTAL_NAV, portalWorldNav } from "../../navigation/portal-nav";
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

/** Player-facing Portal shell — login-first IA, optional world scope. */
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
    >
      {children}
    </AppShell>
  );
}
