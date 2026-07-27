"use client";

import * as React from "react";
import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { persistWorldLastRoute } from "@/src/lib/world-last-route";
import { worldCommands, worldLiveNav, worldSidebar } from "../../navigation/world-nav";
import { AppShell } from "./AppShell";

export interface WorldShellProps {
  worldSlug: string;
  worldName: string;
  breadcrumb?: React.ReactNode;
  contextPanel?: React.ReactNode;
  footer?: React.ReactNode;
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
  navMode = "full",
  liveSessionId,
  children,
}: WorldShellProps) {
  const pathname = usePathname() ?? `/worlds/${worldSlug}/dashboard`;
  useEffect(() => {
    if (pathname) {
      persistWorldLastRoute(worldSlug, pathname);
    }
  }, [pathname, worldSlug]);

  const groups = useMemo(
    () =>
      navMode === "live" && liveSessionId
        ? worldLiveNav(worldSlug, liveSessionId, pathname)
        : worldSidebar(worldSlug, pathname),
    [liveSessionId, navMode, pathname, worldSlug],
  );

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
