"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { navGroupsToCommands, resolveNavGroups, type NavGroup } from "@uwe/shared-utils/navigation";
import { AppShell } from "./AppShell";

export interface ModuleShellProps {
  /** Navigation groups for this module/area (e.g. ORGANIZATION_NAV). */
  groups: NavGroup[];
  brandLabel: string;
  brandHref?: string;
  breadcrumb?: React.ReactNode;
  contextPanel?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Generic module shell for areas with their own navigation (e.g. Organisation). */
export function ModuleShell({
  groups,
  brandLabel,
  brandHref = "/",
  breadcrumb,
  contextPanel,
  footer,
  children,
}: ModuleShellProps) {
  const pathname = usePathname() ?? brandHref;
  return (
    <AppShell
      groups={resolveNavGroups(groups, pathname)}
      commands={navGroupsToCommands(groups)}
      brandLabel={brandLabel}
      brandHref={brandHref}
      breadcrumb={breadcrumb}
      contextPanel={contextPanel}
      footer={footer}
    >
      {children}
    </AppShell>
  );
}
