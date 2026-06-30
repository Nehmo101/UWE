/**
 * Portal navigation — login-first, player-facing IA.
 *
 * No public world-discovery flow. Unauthenticated visitors are sent to login;
 * authenticated players land on "Meine Welten". Part of the central navigation
 * contract (`@uwe/shared-utils/navigation`).
 */
import {
  findNavConflicts,
  flattenNavGroups,
  resolveNavGroups,
  type NavConflicts,
  type NavGroup,
  type NavItem,
  type ResolvedNavGroup,
} from "@uwe/shared-utils/navigation";

const SECTION = "Portal";

/** Top-level authenticated Portal navigation. */
export const PORTAL_NAV: NavGroup[] = [
  {
    id: "portal-main",
    title: "Portal",
    items: [
      {
        id: "portal-my-worlds",
        label: "Meine Welten",
        href: "/auth/worlds",
        icon: "globe",
        group: "Portal",
        section: SECTION,
        permission: ["player", "dm", "admin", "owner", "readonly"],
        status: "active",
        source: "portal",
        keywords: ["welten", "worlds", "meine"],
      },
      {
        id: "portal-account-password",
        label: "Passwort",
        href: "/auth/account/password",
        icon: "lock",
        group: "Account",
        section: SECTION,
        permission: ["player", "dm", "admin", "owner", "readonly"],
        status: "active",
        source: "portal",
        keywords: ["passwort", "account"],
      },
      {
        id: "portal-account-security",
        label: "Sicherheit (2FA)",
        href: "/auth/account/security",
        icon: "shield-check",
        group: "Account",
        section: SECTION,
        permission: ["player", "dm", "admin", "owner", "readonly"],
        status: "active",
        source: "portal",
        keywords: ["2fa", "sicherheit"],
      },
    ],
  },
];

/** World-scoped player navigation inside /auth/worlds/[slug]. */
export function portalWorldNav(worldSlug: string): NavGroup[] {
  const base = `/auth/worlds/${worldSlug}`;
  return [
    {
      id: "portal-world",
      title: "Welt",
      items: [
        worldItem("portal-world-overview", "Übersicht", base, "house", ["übersicht", "dashboard"]),
        worldItem("portal-world-wiki", "Wiki", `${base}/wiki`, "book-open", ["wiki", "seiten"]),
        worldItem("portal-world-sessions", "Sessions / Recaps", `${base}/sessions`, "calendar-days", [
          "sessions",
          "recap",
        ]),
        worldItem("portal-world-handouts", "Handouts", `${base}/assets`, "image", ["handouts", "karten", "assets"]),
        worldItem("portal-world-notes", "Spielernotizen", `${base}/notes`, "sticky-note", ["notizen", "notes"]),
        worldItem("portal-world-soundboard", "Soundboard", `${base}/soundboard`, "music", ["soundboard", "audio"]),
        worldItem("portal-world-atlas", "Atlas", `${base}/atlas`, "map", ["atlas", "karte", "weltkarte"]),
      ],
    },
  ];
}

function worldItem(
  id: string,
  label: string,
  href: string,
  icon: string,
  keywords: string[],
): NavItem {
  return {
    id,
    label,
    href,
    icon,
    group: "Welt",
    section: SECTION,
    permission: ["player", "dm", "admin", "owner", "readonly"],
    status: "active",
    source: "portal",
    keywords,
  };
}

/** Portal sidebar groups with active flags resolved for the current path. */
export function portalSidebar(activePath: string, worldSlug?: string | null): ResolvedNavGroup[] {
  const groups = worldSlug ? [...PORTAL_NAV, ...portalWorldNav(worldSlug)] : PORTAL_NAV;
  return resolveNavGroups(groups, activePath);
}

/** Flat list of portal nav items (optionally including a world scope). */
export function portalNavItems(worldSlug?: string | null): NavItem[] {
  const groups = worldSlug ? [...PORTAL_NAV, ...portalWorldNav(worldSlug)] : PORTAL_NAV;
  return flattenNavGroups(groups);
}

/** Duplicate detection for portal nav (for tests). */
export function portalNavConflicts(worldSlug?: string | null): NavConflicts {
  return findNavConflicts(portalNavItems(worldSlug));
}

/** Minimal navigation for password-protected share links. */
export function shareNavGroups(token: string): NavGroup[] {
  return [
    {
      id: "share",
      title: "Freigabe",
      items: [
        {
          id: "share-root",
          label: "Inhalt",
          href: `/share/${token}`,
          icon: "link",
          group: "Freigabe",
          section: SECTION,
          permission: ["public"],
          status: "active",
          source: "portal",
        },
      ],
    },
  ];
}
