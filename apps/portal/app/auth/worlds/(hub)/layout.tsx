import {
  BreadcrumbTrail,
  PageHeader,
  PortalAuthChrome,
  PortalShell,
} from "@/src/components/shell";
import { getCurrentUser } from "@/src/lib/auth";
import { resolvePortalStudioOpenHref } from "@/src/lib/studio-link";
import { ADMIN_ACCESS_ROLES, hasAnyRole } from "@uwe/auth";
import type { ReactNode } from "react";

export default async function AuthWorldsHubLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const canAccessStudio = user ? hasAnyRole(user, ADMIN_ACCESS_ROLES) : false;
  const studioUrl = canAccessStudio ? resolvePortalStudioOpenHref() : null;

  return (
    <PortalShell
      headerActions={
        <PortalAuthChrome
          user={user}
          canAccessStudio={canAccessStudio}
          studioUrl={studioUrl}
        />
      }
      breadcrumb={<BreadcrumbTrail items={[{ label: "Meine Welten" }]} />}
    >
      <PageHeader
        title="Meine Welten"
        summary={
          user
            ? `Angemeldet als ${user.displayName}`
            : "Melde dich an, um freigegebene Welten zu sehen."
        }
      />
      {children}
    </PortalShell>
  );
}
