import {
  AdminShell,
  SidebarNav,
  SidebarSection,
} from "@uwe/shared-ui";
import { adminSidebarNav } from "@/src/lib/admin-sidebar-nav";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
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
    <AdminShell
      activePath={activePath}
      navItems={adminSidebarNav(activePath)}
      title={title}
      summary={summary}
      actions={actions}
      bottomNav={studioGlobalBottomNav(bottomNav)}
      main={children}
    />
  );
}

/** Legacy sidebar block for pages not yet on AdminShell. */
export function AdminSidebarBlock({ activePath }: { activePath: string }) {
  return (
    <SidebarSection title="UWE Admin">
      <SidebarNav items={adminSidebarNav(activePath)} />
    </SidebarSection>
  );
}
