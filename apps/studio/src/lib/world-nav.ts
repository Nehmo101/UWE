export type WorldNavKey =
  | "overview"
  | "pages"
  | "sessions"
  | "dungeons"
  | "assets"
  | "labels"
  | "notes"
  | "soundboard"
  | "graph"
  | "inspector"
  | "import"
  | "dnd-api"
  | "backup"
  | "brain"
  | "ai-runs"
  | "new-page";

export type WorldBottomNavKey = "overview" | "pages" | "search" | "inspector" | "more";

export interface WorldNavItem {
  key: WorldNavKey;
  label: string;
  href: string;
  active?: boolean;
}

/** Canonical world sidebar for Studio — stable across all world subpages. */
export function worldNavItems(worldSlug: string, active?: WorldNavKey): WorldNavItem[] {
  const base = `/worlds/${worldSlug}`;

  const items: { key: WorldNavKey; label: string; href: string }[] = [
    { key: "overview", label: "Übersicht", href: `${base}/dashboard` },
    { key: "pages", label: "Seiten", href: base },
    { key: "sessions", label: "Sessions", href: `${base}/sessions` },
    { key: "dungeons", label: "Dungeons", href: `${base}/dungeons` },
    { key: "assets", label: "Medien & Assets", href: `${base}/assets` },
    { key: "labels", label: "Labels", href: `${base}/labels` },
    { key: "notes", label: "Spielernotizen", href: `${base}/notes` },
    { key: "soundboard", label: "Soundboard", href: `${base}/soundboard` },
    { key: "graph", label: "Graph", href: `${base}/graph` },
    { key: "brain", label: "Brain Store", href: `${base}/brain` },
    { key: "inspector", label: "Inspektor", href: `${base}/inspector` },
    { key: "ai-runs", label: "KI-Läufe", href: `${base}/ai-runs` },
    { key: "import", label: "Import", href: `${base}/import` },
    { key: "dnd-api", label: "DnD API", href: `${base}/dnd-api` },
    { key: "backup", label: "Backup", href: `${base}/backup` },
    { key: "new-page", label: "Neue Seite", href: `${base}/pages/new` },
  ];

  return items.map((item) => ({
    ...item,
    active: item.key === active,
  }));
}

/** Map world nav key to mobile bottom nav active tab. */
export function worldBottomNavKey(active: WorldNavKey, isSearching = false): WorldBottomNavKey {
  if (isSearching) return "search";
  if (active === "overview") return "overview";
  if (active === "pages" || active === "new-page") return "pages";
  if (active === "inspector") return "inspector";
  return "more";
}

/** Campaign filter sidebar block used on world subpages with campaign scope. */
export function campaignNavItems(
  basePath: string,
  campaigns: { slug: string; name: string }[],
  selectedSlug?: string,
) {
  return [
    { label: "Alle Kampagnen", href: basePath, active: !selectedSlug },
    ...campaigns.map((campaign) => ({
      label: campaign.name,
      href: `${basePath}?campaign=${campaign.slug}`,
      active: selectedSlug === campaign.slug,
    })),
  ];
}
