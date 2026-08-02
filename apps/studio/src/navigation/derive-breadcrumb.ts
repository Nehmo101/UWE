/**
 * Brotkrumen aus dem Navigationsvertrag ableiten.
 *
 * Seit der Shell im Root-Layout sitzt, rendert keine Route mehr ihr eigenes
 * Chrome — die Topbar braucht also einen Pfad, den sie selbst kennt. Für die
 * rund achtzig Listen- und Bereichsseiten reicht dafür die IA: der Nav-Eintrag,
 * der zum Pfad passt, ist genau die Brotkrume. Detailseiten (eine Session, ein
 * Dungeon-Raum, eine Wiki-Seite) tragen einen Titel, den keine Nav-Tabelle
 * kennt; die reichen ihre vollständige Spur über `<ShellBreadcrumb>` nach und
 * überschreiben das Abgeleitete.
 */
import type { BreadcrumbItem } from "@/src/lib/world-breadcrumbs";
import { worldsRootBreadcrumb, worldRootBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { isNavItemActive, type NavItem } from "./types";
import { studioNavItems } from "./studio-nav";
import { worldNavItems } from "./world-nav";

export interface DerivedBreadcrumbWorld {
  slug: string;
  name: string;
}

/**
 * Der spezifischste Treffer gewinnt: `/worlds/terra/labels/print` soll „Labels
 * & Print" zeigen und nicht den kürzeren Präfix-Treffer, der zufällig auch
 * passt. `isNavItemActive` matcht Kindrouten mit, deshalb wird nach Länge
 * sortiert statt beim ersten Treffer abgebrochen.
 */
function bestMatch(items: NavItem[], pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const item of items) {
    if (item.status === "hidden") continue;
    if (!isNavItemActive(pathname, item.href)) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best;
}

/**
 * Brotkrumen für den aktuellen Pfad. `world` ist die Welt der **Route**, nicht
 * die aus dem Cookie: auf `/settings` mit gemerkter Welt steht in der Topbar
 * „Einstellungen", nicht „Welten / Terra / Einstellungen".
 */
export function deriveShellBreadcrumb(
  pathname: string,
  world: DerivedBreadcrumbWorld | null,
): BreadcrumbItem[] {
  if (world && pathname.startsWith(`/worlds/${world.slug}`)) {
    const item = bestMatch(worldNavItems(world.slug), pathname);
    const root = worldRootBreadcrumb(world.name, world.slug);
    // Auf dem Welt-Dashboard selbst wäre „… / Terra / Übersicht" eine
    // Wiederholung des Welt-Segments, das direkt daneben steht.
    if (!item || item.href === `/worlds/${world.slug}/dashboard`) return root;
    return [...root, { label: item.label }];
  }

  if (pathname === "/worlds" || pathname === "/worlds/") {
    return worldsRootBreadcrumb();
  }

  const item = bestMatch(studioNavItems(), pathname);
  return item ? [{ label: item.label }] : [];
}
