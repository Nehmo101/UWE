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
        // Das Postfach liegt seit H10 in Brain — ein Postfach ist Alltag, und
        // Alltag ist owner-privat. In Studio bleibt das Verfassen aus Vorlagen:
        // Session-Recap, Handout und die Welt-Mails sind DM-Arbeit.
        id: "org-mail-compose",
        label: "E-Mail verfassen",
        href: "/mail/compose",
        icon: "mail",
        group: "Kommunikation",
        section: SECTION,
        permission: ["owner", "admin"],
        status: "active",
        source: "organization",
        keywords: ["mail", "email", "vorlage", "compose", "recap", "handout"],
      },
    ],
  },
];
