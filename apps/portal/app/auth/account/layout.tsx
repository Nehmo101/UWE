import { PortalAppShell } from "@/src/components/PortalAppShell";
import { getCurrentUser } from "@/src/lib/auth";
import { portalAuthBottomNav } from "@/src/lib/mobile-nav";
import type { PortalAccountNavKey } from "@/src/lib/portal-navigation";
import { ADMIN_ACCESS_ROLES, hasAnyRole, resolveUweAppUrls } from "@uwe/auth";
import { headers } from "next/headers";
import type { ReactNode } from "react";

export default async function AuthAccountLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const canAccessStudio = user ? hasAnyRole(user, ADMIN_ACCESS_ROLES) : false;
  const appUrls = resolveUweAppUrls();
  const studioUrl = appUrls.studioUrl ?? null;
  const pathname = (await headers()).get("x-uwe-pathname") ?? "/auth/account/password";

  const accountActive: PortalAccountNavKey = pathname.includes("/security")
    ? "security"
    : "password";

  return (
    <PortalAppShell
      user={user}
      canAccessStudio={canAccessStudio}
      studioUrl={studioUrl}
      globalActive="account"
      accountActive={accountActive}
      bottomNav={portalAuthBottomNav(null, "account")}
    >
      {children}
    </PortalAppShell>
  );
}
