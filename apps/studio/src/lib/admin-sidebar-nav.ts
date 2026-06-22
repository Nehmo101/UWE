import { studioFlatNav, type StudioNavItem } from "./studio-navigation";

export type AdminSidebarItem = StudioNavItem;

/** @deprecated Use studioSidebarSections from studio-navigation for new code. */
export function adminSidebarNav(active: string): AdminSidebarItem[] {
  return studioFlatNav(active);
}
