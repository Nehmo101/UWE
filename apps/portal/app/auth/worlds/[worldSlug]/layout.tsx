import {
  BreadcrumbTrail,
  PortalAuthChrome,
  PortalShell,
} from "@/src/components/shell";
import { PortalWorldVisitTracker } from "@/src/components/PortalWorldVisitTracker";
import { getCurrentUser } from "@/src/lib/auth";
import { resolvePortalStudioOpenHref } from "@/src/lib/studio-link";
import { ADMIN_ACCESS_ROLES, hasAnyRole } from "@uwe/auth";
import { createPrismaClient } from "@uwe/database/server";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  params: Promise<{ worldSlug: string }>;
}

export default async function AuthWorldLayout({ children, params }: Props) {
  const { worldSlug } = await params;
  const user = await getCurrentUser();
  const canAccessStudio = user ? hasAnyRole(user, ADMIN_ACCESS_ROLES) : false;
  const studioUrl = canAccessStudio ? resolvePortalStudioOpenHref() : null;

  const db = createPrismaClient();
  let worldName = worldSlug;
  let worldId: string | null = null;
  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, name: true },
    });
    if (world) {
      worldName = world.name;
      worldId = world.id;
    }
  } finally {
    await db.$disconnect();
  }

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
      {worldId ? <PortalWorldVisitTracker worldId={worldId} /> : null}
      {children}
    </PortalShell>
  );
}
