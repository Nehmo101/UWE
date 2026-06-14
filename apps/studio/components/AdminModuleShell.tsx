import {
  AppShell,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
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
    <AppShell
      bottomNav={studioGlobalBottomNav(bottomNav)}
      topBar={<TopBarBrand appName="UWE Studio" subtitle={title} href="/today" />}
      sidebar={
        <SidebarSection title="UWE Admin">
          <SidebarNav items={adminSidebarNav(activePath)} />
        </SidebarSection>
      }
      main={
        <>
          <PageHeader title={title} summary={summary} actions={actions} />
          {children}
        </>
      }
    />
  );
}
