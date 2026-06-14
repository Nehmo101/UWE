export interface AdminSidebarItem {
  label: string;
  href: string;
  active?: boolean;
}

export function adminSidebarNav(active: string): AdminSidebarItem[] {
  const items: AdminSidebarItem[] = [
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
    { label: "Backup", href: "/backup" },
    { label: "Jobs", href: "/jobs" },
    { label: "Systemstatus", href: "/admin/status" },
    { label: "KI-Prompt", href: "/admin/ai-prompt" },
    { label: "Einstellungen", href: "/settings" },
  ];

  return items.map((item) => ({
    ...item,
    active: item.href === active,
  }));
}
