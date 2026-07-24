import { MobileBottomNav, type BottomNavItem } from "../MobileComponents";

/**
 * Mobile Bottom-Nav über die Produktgrenzen: Start ◆ / Studio ☀ / Portal ✦ /
 * Brain ☾ — wie im Handoff (Abschnitt „5 · Mobil").
 *
 * Die vier Ziele liegen auf **verschiedenen Origins**, jeder Wechsel ist also
 * ein voller Seitenaufbau. Mit einer domainweiten Session
 * (SESSION_COOKIE_DOMAIN) bleibt man dabei angemeldet.
 *
 * Sie ersetzt nicht die App-Navigation: die vollständige Navigation der
 * jeweiligen App steckt weiterhin in der Schublade (MobileNav) der Topbar.
 */

export type CrossAppTarget = "start" | "studio" | "portal" | "brain";

export interface CrossAppBottomNavProps {
  /** Welche Fläche gerade offen ist. */
  active: CrossAppTarget;
  /** Apex-/Landing-Origin. */
  startUrl: string;
  studioUrl: string;
  portalUrl: string;
  brainUrl: string;
  /** Brain ausblenden, wenn ein Deployment es nicht zeigen will. */
  brainVisible?: boolean;
}

export function crossAppBottomNavItems({
  active,
  startUrl,
  studioUrl,
  portalUrl,
  brainUrl,
  brainVisible = true,
}: CrossAppBottomNavProps): BottomNavItem[] {
  const items: BottomNavItem[] = [
    { label: "Start", href: startUrl, icon: "◆", active: active === "start" },
    { label: "Studio", href: studioUrl, icon: "☀", active: active === "studio" },
    { label: "Portal", href: portalUrl, icon: "✦", active: active === "portal" },
  ];
  if (brainVisible) {
    items.push({ label: "Brain", href: brainUrl, icon: "☾", active: active === "brain" });
  }
  return items;
}

export function CrossAppBottomNav(props: CrossAppBottomNavProps) {
  return <MobileBottomNav items={crossAppBottomNavItems(props)} />;
}
