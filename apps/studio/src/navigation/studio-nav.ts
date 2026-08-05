/**
 * Studio top-level navigation — the canonical product IA.
 *
 * Drei stabile Bereiche: Start, Welten, System. Das ist die einzige Quelle für
 * die Seitenleiste des App-Shells, die Mobil-Navigation, Brotkrumen, die
 * Befehlspalette und die Tests.
 *
 * Was hier **nicht** mehr steht, und warum: Studio ist die DM-Arbeitsfläche,
 * und gearbeitet wird in einer Welt. Alles, was eine Welt braucht — Brain,
 * KI & Generatoren, Templates, Import, Hintergrund-Jobs — steht im
 * Welt-Cockpit (`./world-nav.ts`) und nur dort; die globale Doppelung war ein
 * zweiter Weg zum selben Ziel ohne Welt-Kontext. Alltag (Mach weiter, Ideen,
 * Bug-Center) ist owner-privat und liegt in Brain. Prompt-Bibliothek und Image
 * Studio sind aus der IA gefallen. Der Admin-Hub und seine Betriebsflächen
 * (Verlauf, KI-Gateway, Prompt-Konsole, NL-Befehle) bleiben als Routen
 * bestehen und sind über die Befehlspalette erreichbar
 * (`STUDIO_PALETTE_EXTRA` in `../lib/studio-navigation.ts`) — die Seitenleiste
 * trägt sie nicht mehr.
 */
import { SYSTEM_NAV } from "./system-nav";
import {
  flattenNavGroups,
  findNavConflicts,
  navGroupsToCommands,
  resolveNavGroups,
  type NavCommand,
  type NavConflicts,
  type NavGroup,
  type NavItem,
  type ResolvedNavGroup,
} from "./types";

const START = "Start";
const WORLDS = "Welten";

export const START_NAV: NavGroup[] = [
  {
    id: "start",
    title: START,
    items: [
      {
        id: "start-search",
        label: "Suche",
        href: "/search",
        icon: "search",
        group: START,
        section: START,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["suche", "search", "command"],
      },
    ],
  },
];

export const WORLDS_NAV: NavGroup[] = [
  {
    id: "worlds",
    title: WORLDS,
    items: [
      {
        id: "worlds-list",
        label: "Alle Welten",
        href: "/worlds",
        icon: "globe",
        group: WORLDS,
        section: WORLDS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["welten", "worlds", "erstellen", "öffnen"],
      },
    ],
  },
];

/** All three Studio areas in canonical order. */
export const STUDIO_NAV: NavGroup[] = [...START_NAV, ...WORLDS_NAV, ...SYSTEM_NAV];

/** Canonical ordered section titles for the Studio sidebar. */
export const STUDIO_SECTIONS = [START, WORLDS, "System"] as const;

/** Studio sidebar groups with active flags resolved for the current path. */
export function studioSidebar(activePath: string): ResolvedNavGroup[] {
  return resolveNavGroups(STUDIO_NAV, activePath);
}

/** Flat list of all Studio nav items. */
export function studioNavItems(): NavItem[] {
  return flattenNavGroups(STUDIO_NAV);
}

/** Command-palette entries derived from the Studio IA (excludes hidden items). */
export function studioCommands(): NavCommand[] {
  return navGroupsToCommands(STUDIO_NAV);
}

/** Duplicate ids/hrefs/labels across the Studio IA (for Navigation overview + tests). */
export function studioNavConflicts(): NavConflicts {
  return findNavConflicts(studioNavItems());
}
