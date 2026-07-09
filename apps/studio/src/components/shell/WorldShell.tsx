"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { ResolvedNavGroup } from "@uwe/shared-utils/navigation";
import { worldCommands, worldLiveNav, worldSidebar } from "../../navigation/world-nav";
import { readHiddenNavIds } from "../../lib/nav-visibility-prefs";
import { AppShell } from "./AppShell";

function filterNavGroups(groups: ResolvedNavGroup[], hidden: Set<string>): ResolvedNavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !hidden.has(item.id)),
    }))
    .filter((group) => group.items.length > 0);
}

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
  const [hiddenNavIds, setHiddenNavIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setHiddenNavIds(readHiddenNavIds());
    const onChange = () => setHiddenNavIds(readHiddenNavIds());
    window.addEventListener("uwe:nav-visibility-changed", onChange);
    return () => window.removeEventListener("uwe:nav-visibility-changed", onChange);
  }, []);

  const groups = useMemo(() => {
    const base =
      navMode === "live" && liveSessionId
        ? worldLiveNav(worldSlug, liveSessionId, pathname)
        : worldSidebar(worldSlug, pathname, openReviewCount);
    return navMode === "live" ? base : filterNavGroups(base, hiddenNavIds);
  }, [hiddenNavIds, liveSessionId, navMode, openReviewCount, pathname, worldSlug]);

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
