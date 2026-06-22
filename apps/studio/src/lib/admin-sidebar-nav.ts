import { ADMIN_ACCESS_ROLES, type AuthUser, hasAnyRole } from "@uwe/auth";
import { studioFlatNav, type StudioNavItem } from "./studio-navigation";

export type AdminSidebarItem = StudioNavItem;

function isAdminOnlyHref(href: string): boolean {
  const path = href.split("?")[0] ?? href;
  return path === "/admin" || path.startsWith("/admin/");
}

/** @deprecated Use studioSidebarSections from studio-navigation for new code. */
export function adminSidebarNav(
  active: string,
  options?: { user?: Pick<AuthUser, "role"> | null },
): AdminSidebarItem[] {
  const isAdmin = options?.user ? hasAnyRole(options.user, ADMIN_ACCESS_ROLES) : true;
  return studioFlatNav(active).filter((item) => isAdmin || !isAdminOnlyHref(item.href));
}
