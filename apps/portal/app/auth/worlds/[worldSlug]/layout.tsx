import {
  BreadcrumbTrail,
  PortalAuthChrome,
  PortalShell,
} from "@/src/components/shell";
import { PortalWorldVisitTracker } from "@/src/components/PortalWorldVisitTracker";
import { notFound } from "next/navigation";
import { getCurrentUser, loadReadableWorld } from "@/src/lib/auth";
import { resolvePortalStudioOpenHref } from "@/src/lib/studio-link";
import { ADMIN_ACCESS_ROLES, hasAnyRole } from "@uwe/auth";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  params: Promise<{ worldSlug: string }>;
}

export default async function AuthWorldLayout({ children, params }: Props) {
  const { worldSlug } = await params;

  // Membership gate before any world metadata is rendered — the shell shows the
  // world name and breadcrumb, which must not leak for a world the viewer may
  // not read. The pages below re-check independently via getAccessContextForWorld.
  const readable = await loadReadableWorld(worldSlug);
  if (!readable) {
    notFound();
  }

  const { world } = readable;
  const worldName = world.name;
  const worldId = world.id;

  const user = await getCurrentUser();
  const canAccessStudio = user ? hasAnyRole(user, ADMIN_ACCESS_ROLES) : false;
  const studioUrl = canAccessStudio ? resolvePortalStudioOpenHref() : null;

  return (
    <PortalShell
      worldSlug={worldSlug}
      worldName={worldName}
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
            { label: worldName },
          ]}
        />
      }
    >
      <PortalWorldVisitTracker worldId={worldId} />
      {children}
    </PortalShell>
  );
}
