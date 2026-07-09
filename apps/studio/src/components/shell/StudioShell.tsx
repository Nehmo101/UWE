"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { ResolvedNavGroup } from "@uwe/shared-utils/navigation";
import { studioCommands, studioSidebar } from "../../navigation/studio-nav";
import { resolveStudioBottomNav } from "../../lib/mobile-nav";
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

export interface StudioShellProps {
  breadcrumb?: React.ReactNode;
  contextPanel?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Top-level Studio shell — global product navigation. */
export function StudioShell({ breadcrumb, contextPanel, footer, children }: StudioShellProps) {
  const pathname = usePathname() ?? "/today";
  const [hiddenNavIds, setHiddenNavIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setHiddenNavIds(readHiddenNavIds());
    const onChange = () => setHiddenNavIds(readHiddenNavIds());
    window.addEventListener("uwe:nav-visibility-changed", onChange);
    return () => window.removeEventListener("uwe:nav-visibility-changed", onChange);
  }, []);

  const groups = useMemo(
    () => filterNavGroups(studioSidebar(pathname), hiddenNavIds),
    [pathname, hiddenNavIds],
  );

  return (
    <AppShell
      groups={groups}
      commands={studioCommands()}
      brandLabel="UWE Studio"
      brandHref="/today"
      breadcrumb={breadcrumb}
      contextPanel={contextPanel}
      footer={footer}
      bottomNav={resolveStudioBottomNav(pathname)}
    >
      {children}
    </AppShell>
  );
}
