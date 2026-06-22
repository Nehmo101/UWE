export interface AdminSidebarItem {
  label: string;
  href: string;
  active?: boolean;
}

export function adminSidebarNav(active: string): AdminSidebarItem[] {
  const items: AdminSidebarItem[] = [
    { label: "Admin Übersicht", href: "/admin" },
    { label: "Heute", href: "/today" },
    { label: "Capture", href: "/capture" },
    { label: "Dashboard", href: "/" },
    { label: "Welten", href: "/worlds" },
    { label: "Projekte", href: "/projects" },
    { label: "Werkstatt", href: "/workshop" },
    { label: "Verträge", href: "/contracts" },
    { label: "Hardware", href: "/hardware" },
    { label: "Brain Store", href: "/brain" },
    { label: "Persönliches Brain", href: "/life-brain" },
    { label: "Templates", href: "/templates" },
    { label: "Mail Center", href: "/mail" },
    { label: "Image Studio", href: "/image-studio" },
    { label: "Kalender", href: "/calendar" },
    { label: "Agent Jobs", href: "/admin/agent-jobs" },
    { label: "Benutzer", href: "/admin/users" },
    { label: "API Tokens", href: "/admin/api-tokens" },
    { label: "Webhooks", href: "/admin/webhooks" },
    { label: "Audit Log", href: "/admin/audit-log" },
    { label: "Tags", href: "/admin/tags" },
    { label: "Backup", href: "/backup" },
    { label: "Jobs", href: "/jobs" },
    { label: "Systemstatus", href: "/admin/status" },
    { label: "Security", href: "/admin/security" },
    { label: "KI-Prompt", href: "/admin/ai-prompt" },
    { label: "Cookbook", href: "/admin/cookbook" },
    { label: "Einstellungen", href: "/settings" },
  ];

  return items.map((item) => ({
    ...item,
    active: item.href === active,
  }));
}
