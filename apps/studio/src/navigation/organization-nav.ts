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
        keywords: ["ideen", "ideas", "prompt", "ideen-management"],
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
];

/*
 * Hier stand die Gruppe „Kommunikation" mit einem Eintrag: „E-Mail verfassen"
 * auf `/mail/compose`. Diese Route ist kein Einstieg, sondern ein Ziel — sie
 * ruft `notFound()`, sobald `?kind=` fehlt, und braucht zusätzlich `worldSlug`
 * und `sourceId`. Aus der Seitenleiste aufgerufen kam deshalb immer eine leere
 * Seite heraus.
 *
 * Die Route bleibt: erreicht wird sie da, wo sie ihren Kontext mitbringt — aus
 * dem Session-Recap, aus einem Handout und aus den Welt-Mails. Das Postfach
 * selbst liegt seit H10 in Brain (ein Postfach ist Alltag, und Alltag ist
 * owner-privat).
 */
