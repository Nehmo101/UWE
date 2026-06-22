import { StudioAppShell } from "@/components/StudioAppShell";
import { adminSidebarNav } from "@/src/lib/admin-sidebar-nav";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
import { SidebarNav, SidebarSection } from "@uwe/shared-ui";
import type { ReactNode } from "react";

interface AdminModuleShellProps {
  activePath: string;
  title: string;
  summary: string;
  bottomNav?: "today" | "capture" | "search" | "ai" | "more";
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminModuleShell({
  activePath,
  title,
  summary,
  bottomNav = "more",
  actions,
  children,
}: AdminModuleShellProps) {
  return (
    <StudioAppShell
      variant="module"
      activePath={activePath}
      title={title}
      summary={summary}
      actions={actions}
      bottomNav={studioGlobalBottomNav(bottomNav)}
    >
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
