import { PortalAppShell } from "@/src/components/PortalAppShell";
import { getCurrentUser } from "@/src/lib/auth";
import { resolvePortalWorldNavKey } from "@/src/lib/portal-navigation";
import { portalAuthBottomNav } from "@/src/lib/mobile-nav";
import { ADMIN_ACCESS_ROLES, hasAnyRole, resolveUweAppUrls } from "@uwe/auth";
import { createPrismaClient } from "@uwe/database/server";
import { headers } from "next/headers";
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
  const headerList = await headers();
  const pathname = headerList.get("x-uwe-pathname") ?? `/auth/worlds/${worldSlug}`;

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

  const worldActive = resolvePortalWorldNavKey(pathname, worldSlug);
  const bottomNavActive =
    worldActive === "sessions"
      ? "sessions"
      : worldActive === "handouts"
        ? "handouts"
        : worldActive === "notes" || worldActive === "soundboard" || worldActive === "search"
          ? "more"
          : "dashboard";

  return (
    <PortalAppShell
      user={user}
      canAccessStudio={canAccessStudio}
      studioUrl={studioUrl}
      worldSlug={worldSlug}
      worldName={worldName}
      worldActive={worldActive}
      globalActive="worlds"
      bottomNav={portalAuthBottomNav(worldSlug, bottomNavActive)}
    >
      {children}
    </PortalAppShell>
  );
}
