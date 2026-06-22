import { PortalAppShell } from "@/src/components/PortalAppShell";
import { getCurrentUser } from "@/src/lib/auth";
import { portalAuthBottomNav } from "@/src/lib/mobile-nav";
import { ADMIN_ACCESS_ROLES, hasAnyRole, resolveUweAppUrls } from "@uwe/auth";
import type { ReactNode } from "react";

export default async function AuthWorldsHubLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const canAccessStudio = user ? hasAnyRole(user, ADMIN_ACCESS_ROLES) : false;
  const appUrls = resolveUweAppUrls();
  const studioUrl = appUrls.studioUrl ?? null;

  return (
    <PortalAppShell
      user={user}
      canAccessStudio={canAccessStudio}
      studioUrl={studioUrl}
      globalActive="worlds"
      bottomNav={portalAuthBottomNav(null, "worlds")}
      pageHeader={{
        title: "Meine Welten",
        summary: user
          ? `Angemeldet als ${user.displayName}`
          : "Melde dich an, um freigegebene Welten zu sehen.",
      }}
    >
      {children}
    </PortalAppShell>
  );
}
