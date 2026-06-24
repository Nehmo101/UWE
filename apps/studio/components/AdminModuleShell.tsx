import { StudioAppShell } from "@/components/StudioAppShell";
import { StudioAppShellV2 } from "@/components/StudioAppShellV2";
import { adminSidebarNav } from "@/src/lib/admin-sidebar-nav";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
import { isDesignV2Enabled, SidebarNav, SidebarSection } from "@uwe/shared-ui";
import type { ReactNode } from "react";

interface AdminModuleShellProps {
  activePath: string;
  title: string;
  summary: string;
  bottomNav?: "today" | "capture" | "search" | "ai" | "more";
  actions?: ReactNode;
  context?: ReactNode;
  contextTitle?: string;
  showSearch?: boolean;
  breadcrumbs?: { label: string; href?: string }[];
  backHref?: string;
  backLabel?: string;
  topBarExtra?: ReactNode;
  children: ReactNode;
}

export function AdminModuleShell({
  activePath,
  title,
  summary,
  bottomNav = "more",
  actions,
  context,
  contextTitle,
  showSearch,
  breadcrumbs,
  backHref,
  backLabel,
  topBarExtra,
  children,
}: AdminModuleShellProps) {
  const shellProps = {
    variant: "module" as const,
    activePath,
    title,
    summary,
    actions,
    bottomNav: studioGlobalBottomNav(bottomNav),
    context,
    contextTitle,
    showSearch,
    breadcrumbs,
    backHref,
    backLabel,
    topBarExtra,
  };

  if (isDesignV2Enabled()) {
    return <StudioAppShellV2 {...shellProps}>{children}</StudioAppShellV2>;
  }

  return (
    <StudioAppShell {...shellProps}>
      {children}
    </StudioAppShell>
  );
}

/** Legacy sidebar block for pages not yet on StudioAppShell. */
export function AdminSidebarBlock({ activePath }: { activePath: string }) {
  return (
    <SidebarSection title="UWE Studio">
      <SidebarNav items={adminSidebarNav(activePath)} />
    </SidebarSection>
  );
}
