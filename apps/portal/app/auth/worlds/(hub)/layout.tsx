import {
  BreadcrumbTrail,
  PageHeader,
  PortalAuthChrome,
  PortalShell,
} from "@/src/components/shell";
import { getCurrentUser } from "@/src/lib/auth";
import { resolveLandingPublicBaseUrl } from "@uwe/auth";
import type { ReactNode } from "react";

export default async function AuthWorldsHubLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <PortalShell
      headerActions={
        <PortalAuthChrome user={user} startUrl={resolveLandingPublicBaseUrl()} />
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
