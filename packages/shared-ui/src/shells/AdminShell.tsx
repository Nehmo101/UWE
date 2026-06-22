import type { ReactNode } from "react";
import {
  AppShell,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "../AppShell";
import type { BottomNavItem } from "../MobileComponents";

export interface AdminShellProps {
  main: ReactNode;
  activePath: string;
  navItems: { label: string; href: string; active?: boolean; badge?: string }[];
  title: string;
  summary: string;
  actions?: ReactNode;
  bottomNav?: BottomNavItem[];
  statusStrip?: ReactNode;
  brandHref?: string;
}

/** Owner/admin shell with status cards and prominent admin navigation. */
export function AdminShell({
  main,
  activePath: _activePath,
  navItems,
  title,
  summary,
  actions,
  bottomNav,
  statusStrip,
  brandHref = "/admin",
}: AdminShellProps) {
  return (
    <AppShell
      bottomNav={bottomNav}
      topBar={
        <TopBarBrand appName="UWE Studio" subtitle="Admin" href={brandHref} />
      }
      sidebar={
        <SidebarSection title="Admin">
          <SidebarNav items={navItems} />
        </SidebarSection>
      }
      main={
        <>
          <PageHeader title={title} summary={summary} actions={actions} />
          {statusStrip}
          {main}
        </>
      }
    />
  );
}

export function AdminStatusGrid({ children }: { children: ReactNode }) {
  return <div className="uwe-admin-status-grid">{children}</div>;
}

export function AdminStatusCard({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="uwe-admin-status-card uwe-card">
      <h3 className="uwe-admin-status-card-title">{title}</h3>
      <div className="uwe-admin-status-card-body">{children}</div>
      {actions && <div className="uwe-admin-status-card-actions">{actions}</div>}
    </article>
  );
}
