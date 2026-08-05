import { studioCommands } from "../navigation/studio-nav";
import { worldNavItems as canonicalWorldNavItems } from "../navigation/world-nav";

/** DM tools surfaced on the world dashboard for discoverability (canonical world IA). */
export function worldDmToolQuickLinks(worldSlug: string): { label: string; href: string }[] {
  const highlightIds = new Set([
    "world-campaigns",
    "world-prepare-session",
    "world-one-shot",
    "world-open-items",
    "world-quality",
    "world-inspector",
    "world-roll-tables",
    "world-print-center",
    "world-ai-runs",
    "world-terra",
    "world-magic-items",
  ]);
  return canonicalWorldNavItems(worldSlug)
    .filter((item) => highlightIds.has(item.id))
    .map((item) => ({ label: item.label, href: item.href }));
}

/*
 * Die fruehere zweite Nav-Quelle (worldNavSections, worldBottomNavKey,
 * resolveWorldNavKey samt WorldNavKey-Typen) ist abgebaut: sie hatte keine
 * Konsumenten mehr und driftete gegen die kanonische IA in
 * src/navigation/world-nav.ts (anderes Label, fehlende Eintraege). Wer eine
 * Welt-Navigation braucht, nimmt worldNav()/worldNavItems() von dort.
 */

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

export interface StudioPaletteCommand {
  id: string;
  label: string;
  href: string;
  group: string;
  keywords?: string[];
  /** Lucide icon name (kebab-case) for the command palette; optional for legacy callers. */
  icon?: string;
}

/**
 * Sub-routes and deep links missing from the main Studio sidebar IA.
 *
 * Nur echte Studio-Routen. Vier Einträge sind hier herausgeflogen, weil sie das
 * nicht (mehr) waren: `/workshop/rental` und `/workshop/print-profiles` (die
 * Werkstatt liegt in Brain), `/life-brain` (owner-privater Alltag, ebenfalls
 * Brain) und `/mail/compose` — letzteres existiert zwar, ruft aber `notFound()`,
 * sobald `?kind=` fehlt, und ist damit kein Sprungziel, sondern ein Ziel mit
 * Kontext (Session-Recap, Handout).
 */
export const STUDIO_PALETTE_EXTRA: {
  id: string;
  label: string;
  href: string;
  group: string;
  keywords?: string[];
}[] = [
  { id: "admin-hub", label: "Admin Übersicht", href: "/admin", group: "System / Betrieb", keywords: ["admin", "betrieb", "übersicht"] },
  { id: "admin-activity", label: "Verlauf", href: "/admin/activity", group: "System / Betrieb", keywords: ["activity", "audit", "verlauf"] },
  { id: "admin-ai-gateway", label: "AI Gateway", href: "/admin/ai-gateway", group: "System / Betrieb", keywords: ["gateway", "provider", "model", "budget"] },
  { id: "admin-ai-prompt", label: "Prompt-Konsole", href: "/admin/ai-prompt", group: "System / Betrieb", keywords: ["prompt", "konsole", "ollama", "engine"] },
  { id: "command-center", label: "NL Command Center", href: "/command", group: "System / Betrieb", keywords: ["command", "nl", "admin"] },
];

const PAGE_TEMPLATE_SHORTCUTS: {
  id: string;
  label: string;
  template: string;
  keywords: string[];
}[] = [
  { id: "new-npc", label: "NPC erstellen", template: "npc", keywords: ["create", "charakter"] },
  { id: "new-ort", label: "Ort erstellen", template: "ort", keywords: ["create", "location", "stadt"] },
  {
    id: "new-fraktion",
    label: "Fraktion erstellen",
    template: "fraktion",
    keywords: ["create", "faction", "gilde"],
  },
  { id: "new-quest", label: "Quest erstellen", template: "quest", keywords: ["create", "auftrag"] },
  {
    id: "new-handout",
    label: "Handout erstellen",
    template: "handout",
    keywords: ["create", "brief"],
  },
];

/** Command-palette entries derived from canonical Studio IA. */
export function studioCommandPaletteCommands(options: {
  worlds: { name: string; slug: string }[];
  worldSlug?: string | null;
  pathname?: string;
}): StudioPaletteCommand[] {
  const { worlds, worldSlug, pathname = "" } = options;
  const list: StudioPaletteCommand[] = [];

  // „Schnell erfassen" auf `/capture?quick=1` stand hier an erster Stelle der
  // Palette — die Route gibt es in Studio nicht, Capture liegt in Brain.

  if (worldSlug) {
    const base = `/worlds/${worldSlug}`;
    const world = worlds.find((entry) => entry.slug === worldSlug);
    const fallbackGroup = world ? `Welt: ${world.name}` : "Aktuelle Welt";

    for (const item of canonicalWorldNavItems(worldSlug)) {
      list.push({
        id: item.id,
        label: `${item.label} öffnen`,
        href: item.href,
        group: `${fallbackGroup} / ${item.group}`,
        icon: item.icon,
        keywords: item.keywords,
      });
    }

    for (const shortcut of PAGE_TEMPLATE_SHORTCUTS) {
      list.push({
        id: shortcut.id,
        label: shortcut.label,
        href: `${base}/pages/new?template=${shortcut.template}`,
        group: `${fallbackGroup} / Inhalte`,
        icon: "file-plus",
        keywords: shortcut.keywords,
      });
    }

    const pageMatch = pathname.match(
      /^\/worlds\/[^/]+\/(?:pages|npcs|orte|fraktionen|quests|handouts|items|notes|encounters|secrets|traps|puzzles|loot|rooms)\/([^/]+)/,
    );
    if (pageMatch) {
      list.push({
        id: "new-label-from-url",
        label: "Label aus aktueller Seite",
        href: `${base}/labels/new`,
        group: `${fallbackGroup} / Medien`,
        icon: "tag",
        keywords: ["label", "quelle"],
      });
    }
  }

  for (const command of studioCommands()) {
    list.push({
      id: command.id,
      label: `${command.label} öffnen`,
      href: command.href,
      group: command.group,
      icon: command.icon,
      keywords: command.keywords,
    });
  }

  const seenHrefs = new Set(list.map((entry) => entry.href.split("?")[0]));
  for (const shortcut of STUDIO_PALETTE_EXTRA) {
    const normalizedHref = shortcut.href.split("?")[0];
    if (seenHrefs.has(normalizedHref)) continue;
    seenHrefs.add(normalizedHref);
    list.push({
      id: shortcut.id,
      label: `${shortcut.label} öffnen`,
      href: shortcut.href,
      group: shortcut.group,
      icon: "arrow-up-right",
      keywords: shortcut.keywords,
    });
  }

  for (const world of worlds) {
    if (world.slug === worldSlug) continue;
    list.push({
      id: `open-world-${world.slug}`,
      label: `Welt öffnen: ${world.name}`,
      href: `/worlds/${world.slug}/dashboard`,
      group: "Welten",
      icon: "globe",
      keywords: [world.slug],
    });
  }

  return list;
}
