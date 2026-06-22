import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import { worldNavItems, type WorldNavKey } from "@/src/lib/world-nav";
import { studioWorldBottomNav } from "@/src/lib/mobile-nav";
import { STUDIO_DASHBOARD_PATH } from "@/src/lib/routes";
import type { ReactNode } from "react";

interface WorldModuleShellProps {
  worldSlug: string;
  worldName: string;
  activeNav: WorldNavKey;
  title: string;
  summary?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
  children: ReactNode;
  context?: ReactNode;
  contextTitle?: string;
}

export function WorldModuleShell({
  worldSlug,
  worldName,
  activeNav,
  title,
  summary,
  breadcrumbs,
  actions,
  children,
  context,
  contextTitle,
}: WorldModuleShellProps) {
  const trail: { label: string; href?: string }[] = breadcrumbs ?? [
    { label: "Dashboard", href: STUDIO_DASHBOARD_PATH },
    { label: worldName, href: `/worlds/${worldSlug}/dashboard` },
    { label: title },
  ];

  return (
    <AppShell
      bottomNav={studioWorldBottomNav(worldSlug, activeNav === "pages" ? "pages" : activeNav === "inspector" ? "inspector" : "overview")}
      topBar={
        <TopBarBrand
          appName="UWE Studio"
          subtitle={worldName}
          href={`/worlds/${worldSlug}/dashboard`}
        />
      }
      sidebar={
        <>
          <SidebarSection title="Welt">
            <SidebarNav
              items={[
                { label: "← Dashboard", href: STUDIO_DASHBOARD_PATH },
                ...worldNavItems(worldSlug, activeNav),
              ]}
            />
          </SidebarSection>
        </>
      }
      context={context}
      contextTitle={contextTitle}
      main={
        <>
          <Breadcrumb items={trail} />
          <PageHeader title={title} summary={summary} actions={actions} />
          {children}
        </>
      }
    />
  );
}
