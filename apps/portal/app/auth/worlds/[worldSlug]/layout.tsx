import {
  BreadcrumbTrail,
  PortalAuthChrome,
  PortalShell,
} from "@/src/components/shell";
import { getCurrentUser } from "@/src/lib/auth";
import { ADMIN_ACCESS_ROLES, hasAnyRole, resolveUweAppUrls } from "@uwe/auth";
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
  const appUrls = resolveUweAppUrls();
  const studioUrl = appUrls.studioUrl ?? null;

  const db = createPrismaClient();
  let worldName = worldSlug;
  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { name: true },
    });
    if (world) worldName = world.name;
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
      {children}
    </PortalShell>
  );
}
