/**
 * Organisation area navigation — Daily/Admin/Organisation features consolidated
 * into one clear area instead of being scattered across the main menu.
 * Backend stays intact; most of these get new UI in a later migration pass.
 * Part of the central navigation contract (see ./types.ts).
 */
import type { NavGroup } from "./types";

const SECTION = "Organisation";

export const ORGANIZATION_NAV: NavGroup[] = [
  {
    id: "org-work",
    title: "Arbeit & Projekte",
    items: [
      {
        id: "org-contracts",
        label: "Verträge",
        href: "/contracts",
        icon: "file-text",
        group: "Arbeit & Projekte",
        section: SECTION,
        permission: ["owner", "admin"],
        status: "active",
        source: "organization",
        keywords: ["verträge", "contracts"],
      },
      {
        id: "org-documents",
        label: "Dokumente",
        href: "/documents",
        icon: "file-text",
        group: "Arbeit & Projekte",
        section: SECTION,
        permission: ["owner", "admin"],
        status: "active",
        source: "organization",
        keywords: ["dokumente", "documents", "vorlagen", "templates", "generator"],
      },
      {
        id: "org-ideas",
        label: "Ideen",
        href: "/ideas",
        icon: "lightbulb",
        group: "Arbeit & Projekte",
        section: SECTION,
        permission: ["owner"],
        status: "active",
        source: "organization",
        keywords: ["ideen", "ideas", "cursor", "prompt", "agent", "ideen-management"],
      },
      {
        id: "org-bugs",
        label: "Bug-Center",
        href: "/bugs",
        icon: "bug",
        group: "Arbeit & Projekte",
        section: SECTION,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "organization",
        keywords: ["bug", "bugs", "fehler", "bug-center", "bug-report"],
      },
    ],
  },
  {
    id: "org-comms",
    title: "Kommunikation",
    items: [
      {
        id: "org-mail",
        label: "Mail",
        href: "/mail",
        icon: "mail",
        group: "Kommunikation",
        section: SECTION,
        permission: ["owner", "admin"],
        status: "active",
        source: "organization",
        keywords: ["mail", "email", "inbox"],
      },
      {
        id: "org-calendar",
        label: "Kalender",
        href: "/calendar",
        icon: "calendar",
        group: "Kommunikation",
        section: SECTION,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "organization",
        keywords: ["kalender", "calendar", "events"],
      },
    ],
  },
];
