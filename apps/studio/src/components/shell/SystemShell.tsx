"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { resolveNavGroups, navGroupsToCommands } from "@uwe/shared-utils/navigation";
import { SYSTEM_NAV } from "../../navigation/system-nav";
import { AppShell } from "./AppShell";

export interface SystemShellProps {
  breadcrumb?: React.ReactNode;
  contextPanel?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** System area shell — owner/admin operations. */
export function SystemShell({ breadcrumb, contextPanel, footer, children }: SystemShellProps) {
  const pathname = usePathname() ?? "/system";
  return (
    <AppShell
      groups={resolveNavGroups(SYSTEM_NAV, pathname)}
      commands={navGroupsToCommands(SYSTEM_NAV)}
      brandLabel="UWE System"
      brandHref="/system"
      breadcrumb={breadcrumb}
      contextPanel={contextPanel}
      footer={footer}
    >
      {children}
    </AppShell>
  );
}
