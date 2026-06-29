"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { navGroupsToCommands, resolveNavGroups } from "@uwe/shared-utils/navigation";
import { PORTAL_NAV, portalWorldNav } from "../../navigation/portal-nav";
import { AppShell } from "./AppShell";

export interface PortalShellProps {
  /** Optional active world to add world-scoped navigation. */
  worldSlug?: string | null;
  worldName?: string;
  breadcrumb?: React.ReactNode;
  contextPanel?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Player-facing Portal shell — login-first IA, optional world scope. */
export function PortalShell({
  worldSlug,
  worldName,
  breadcrumb,
  contextPanel,
  footer,
  children,
}: PortalShellProps) {
  const pathname = usePathname() ?? "/auth/worlds";
  const groups = worldSlug ? [...PORTAL_NAV, ...portalWorldNav(worldSlug)] : PORTAL_NAV;

  return (
    <AppShell
      groups={resolveNavGroups(groups, pathname)}
      commands={navGroupsToCommands(groups)}
      brandLabel={worldName ?? "UWE Portal"}
      brandHref="/auth/worlds"
      breadcrumb={breadcrumb}
      contextPanel={contextPanel}
      footer={footer}
    >
      {children}
    </AppShell>
  );
}
