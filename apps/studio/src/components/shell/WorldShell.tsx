"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { worldCommands, worldSidebar } from "../../navigation/world-nav";
import { AppShell } from "./AppShell";

export interface WorldShellProps {
  worldSlug: string;
  worldName: string;
  breadcrumb?: React.ReactNode;
  contextPanel?: React.ReactNode;
  footer?: React.ReactNode;
  openReviewCount?: number;
  children: React.ReactNode;
}

/** World cockpit shell — stable per-world navigation. */
export function WorldShell({
  worldSlug,
  worldName,
  breadcrumb,
  contextPanel,
  footer,
  openReviewCount,
  children,
}: WorldShellProps) {
  const pathname = usePathname() ?? `/worlds/${worldSlug}/dashboard`;
  return (
    <AppShell
      groups={worldSidebar(worldSlug, pathname, openReviewCount)}
      commands={worldCommands(worldSlug)}
      brandLabel={worldName}
      brandHref={`/worlds/${worldSlug}/dashboard`}
      breadcrumb={breadcrumb}
      contextPanel={contextPanel}
      footer={footer}
    >
      {children}
    </AppShell>
  );
}
