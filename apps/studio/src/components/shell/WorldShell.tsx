"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { worldCommands, worldLiveNav, worldSidebar } from "../../navigation/world-nav";
import { AppShell } from "./AppShell";

export interface WorldShellProps {
  worldSlug: string;
  worldName: string;
  breadcrumb?: React.ReactNode;
  contextPanel?: React.ReactNode;
  footer?: React.ReactNode;
  openReviewCount?: number;
  navMode?: "full" | "live";
  liveSessionId?: string;
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
  navMode = "full",
  liveSessionId,
  children,
}: WorldShellProps) {
  const pathname = usePathname() ?? `/worlds/${worldSlug}/dashboard`;
  const groups =
    navMode === "live" && liveSessionId
      ? worldLiveNav(worldSlug, liveSessionId, pathname)
      : worldSidebar(worldSlug, pathname, openReviewCount);

  return (
    <AppShell
      groups={groups}
      commands={worldCommands(worldSlug)}
      brandLabel={worldName}
      brandHref={`/worlds/${worldSlug}/dashboard`}
      breadcrumb={breadcrumb}
      contextPanel={navMode === "live" ? undefined : contextPanel}
      footer={footer}
    >
      {children}
    </AppShell>
  );
}
