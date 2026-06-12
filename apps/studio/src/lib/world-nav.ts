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
  | "backup"
  | "new-page";

/** Canonical world sidebar for Studio. */
export function worldNavItems(worldSlug: string, active?: WorldNavKey) {
  const base = `/worlds/${worldSlug}`;

  const items: { key: WorldNavKey; label: string; href: string }[] = [
    { key: "overview", label: "Übersicht", href: `${base}/dashboard` },
    { key: "pages", label: "Seiten", href: base },
    { key: "sessions", label: "Sessions", href: `${base}/sessions` },
    { key: "dungeons", label: "Dungeons", href: `${base}/dungeons` },
    { key: "assets", label: "Assets", href: `${base}/assets` },
    { key: "labels", label: "Labels", href: `${base}/labels` },
    { key: "notes", label: "Spielernotizen", href: `${base}/notes` },
    { key: "soundboard", label: "Soundboard", href: `${base}/soundboard` },
    { key: "graph", label: "Graph", href: `${base}/graph` },
    { key: "inspector", label: "Inspektor", href: `${base}/inspector` },
    { key: "import", label: "Import", href: `${base}/import` },
    { key: "backup", label: "Backup", href: `${base}/backup` },
    { key: "new-page", label: "Neue Seite", href: `${base}/pages/new` },
  ];

  return items.map((item) => ({
    label: item.label,
    href: item.href,
    active: item.key === active,
  }));
}
