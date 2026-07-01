import {
  BreadcrumbTrail,
  PortalAuthChrome,
  PortalShell,
} from "@/src/components/shell";
import { getCurrentUser } from "@/src/lib/auth";
import { resolvePortalStudioOpenHref } from "@/src/lib/studio-link";
import { ADMIN_ACCESS_ROLES, hasAnyRole } from "@uwe/auth";
import { headers } from "next/headers";
import type { ReactNode } from "react";

export default async function AuthAccountLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const canAccessStudio = user ? hasAnyRole(user, ADMIN_ACCESS_ROLES) : false;
  const studioUrl = canAccessStudio ? resolvePortalStudioOpenHref() : null;
  const pathname = (await headers()).get("x-uwe-pathname") ?? "/auth/account/password";

  const accountLabel = pathname.includes("/security") ? "Sicherheit (2FA)" : "Passwort";

  return (
    <PortalShell
      headerActions={
        <PortalAuthChrome
          user={user}
          canAccessStudio={canAccessStudio}
          studioUrl={studioUrl}
        />
      }
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Meine Welten", href: "/auth/worlds" },
            { label: accountLabel },
          ]}
        />
      }
    >
      {children}
    </PortalShell>
  );
}
