import { ADMIN_ACCESS_ROLES, type AuthUser, hasAnyRole } from "@uwe/auth";
import { STUDIO_DASHBOARD_PATH } from "./routes";

export interface AdminSidebarItem {
  label: string;
  href: string;
  active?: boolean;
  adminOnly?: boolean;
}

const NAV_ITEMS: AdminSidebarItem[] = [
  { label: "Admin Übersicht", href: "/admin", adminOnly: true },
  { label: "Heute", href: "/today" },
  { label: "Capture", href: "/capture" },
  { label: "Dashboard", href: STUDIO_DASHBOARD_PATH },
  { label: "Welten", href: "/worlds" },
  { label: "Projekte", href: "/projects" },
  { label: "Werkstatt", href: "/workshop" },
  { label: "Verträge", href: "/contracts" },
  { label: "Hardware", href: "/hardware" },
  { label: "Brain Store", href: "/brain" },
  { label: "Persönliches Brain", href: "/life-brain" },
  { label: "Templates", href: "/templates" },
  { label: "Mail Center", href: "/mail" },
  { label: "Mail Portal", href: "/admin/mail", adminOnly: true },
  { label: "Image Studio", href: "/image-studio" },
  { label: "Kalender", href: "/calendar" },
  { label: "Agent Jobs", href: "/admin/agent-jobs", adminOnly: true },
  { label: "Reviews", href: "/admin/reviews", adminOnly: true },
  { label: "Benutzer", href: "/admin/users", adminOnly: true },
  { label: "API Tokens", href: "/admin/api-tokens", adminOnly: true },
  { label: "Webhooks", href: "/admin/webhooks", adminOnly: true },
  { label: "Audit Log", href: "/admin/audit-log", adminOnly: true },
  { label: "Tags", href: "/admin/tags", adminOnly: true },
  { label: "Backup", href: "/backup" },
  { label: "Jobs", href: "/jobs" },
  { label: "Systemstatus", href: "/admin/status", adminOnly: true },
  { label: "Security", href: "/admin/security", adminOnly: true },
  { label: "KI-Prompt", href: "/admin/ai-prompt", adminOnly: true },
  { label: "KI-Gateway", href: "/admin/ai-gateway", adminOnly: true },
  { label: "Cookbook", href: "/admin/cookbook", adminOnly: true },
  { label: "Einstellungen", href: "/settings" },
];

export function adminSidebarNav(
  active: string,
  options?: { user?: Pick<AuthUser, "role"> | null },
): AdminSidebarItem[] {
  const isAdmin = options?.user ? hasAnyRole(options.user, ADMIN_ACCESS_ROLES) : true;

  return NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly).map((item) => ({
    ...item,
    active: item.href === active,
  }));
}
