"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { studioCommands, studioSidebar } from "../../navigation/studio-nav";
import { resolveStudioBottomNav } from "../../lib/mobile-nav";
import { AppShell } from "./AppShell";

export interface StudioShellProps {
  breadcrumb?: React.ReactNode;
  contextPanel?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Top-level Studio shell — global product navigation. */
export function StudioShell({ breadcrumb, contextPanel, footer, children }: StudioShellProps) {
  const pathname = usePathname() ?? "/today";
  return (
    <AppShell
      groups={studioSidebar(pathname)}
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
