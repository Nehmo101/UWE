"use client";

import * as React from "react";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { studioCommands, studioSidebar } from "../../navigation/studio-nav";
import { crossAppBottomNavItems, readClientAppUrls } from "@uwe/shared-ui";
import { AppShell } from "./AppShell";

export interface StudioShellProps {
  breadcrumb?: React.ReactNode;
  contextPanel?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Top-level Studio shell — global product navigation. */
export function StudioShell({ breadcrumb, contextPanel, footer, children }: StudioShellProps) {
  const pathname = usePathname() ?? "/worlds";
  const appUrls = useMemo(() => {
    const urls = readClientAppUrls();
    return {
      startUrl: urls.start,
      studioUrl: urls.studio,
      portalUrl: urls.portal,
      brainUrl: urls.brain,
    };
  }, []);
  const groups = useMemo(() => studioSidebar(pathname), [pathname]);

  return (
    <AppShell
      groups={groups}
      commands={studioCommands()}
      brandLabel="UWE Studio"
      brandHref="/worlds"
      breadcrumb={breadcrumb}
      contextPanel={contextPanel}
      footer={footer}
      // Handoff, Abschnitt „5 · Mobil": die Bottom-Nav schaltet zwischen den
      // Produkten, nicht innerhalb einer App. Die vollständige Studio-Navigation
      // bleibt in der Schublade der Topbar erreichbar.
      bottomNav={crossAppBottomNavItems({ active: "studio", ...appUrls })}
    >
      {children}
    </AppShell>
  );
}
