/**
 * Navigations-Kontrakt der Family-App.
 *
 * Eine Quelle für Sidebar und Suchleiste — wie Brain, Studio und Portal. Family
 * nutzt keine Icon-Bibliothek, `icon` ist deshalb eine Textglyphe.
 */
import type { NavSearchEntry } from "@uwe/shared-ui";

export interface FamilyNavLink {
  href: string;
  label: string;
  /** Textglyphe (Family rendert Icons als Zeichen, nicht als SVG). */
  icon: string;
  /** Synonyme für die Bereichssuche. */
  keywords?: string[];
}

export interface FamilyNavSection {
  title: string;
  links: FamilyNavLink[];
}

export const FAMILY_NAV_SECTIONS: FamilyNavSection[] = [
  {
    title: "Überblick",
    links: [
      { href: "/", label: "Start", icon: "◆", keywords: ["start", "home", "heute", "übersicht"] },
      {
        href: "/chat",
        label: "Family-Chat",
        icon: "◈",
        keywords: ["chat", "ki", "assistent", "gemeinsam", "wissen"],
      },
      {
        href: "/chat/privat",
        label: "Privater Chat",
        icon: "✧",
        keywords: ["privat", "chat", "ki", "nur ich"],
      },
    ],
  },
  {
    title: "Haushalt",
    links: [
      {
        href: "/contracts",
        label: "Verträge",
        icon: "€",
        keywords: ["verträge", "abos", "kündigung", "kosten", "finanzen"],
      },
      {
        href: "/documents",
        label: "Dokumente",
        icon: "▦",
        keywords: ["dokumente", "papiere", "vorlagen", "ablage"],
      },
      {
        href: "/calendar",
        label: "Kalender",
        icon: "◷",
        keywords: ["kalender", "termine", "events", "familie"],
      },
    ],
  },
  {
    title: "Verwaltung",
    links: [
      {
        href: "/members",
        label: "Mitglieder",
        icon: "☺",
        keywords: ["mitglieder", "personen", "familie", "zugang"],
      },
    ],
  },
];

/** Durchsuchbare Bereiche für die Suchleiste in der Family-Topbar. */
export function familySearchEntries(): NavSearchEntry[] {
  return FAMILY_NAV_SECTIONS.flatMap((section) =>
    section.links.map((link) => ({
      id: `family${link.href === "/" ? "-start" : link.href.replace(/\//g, "-")}`,
      label: link.label,
      href: link.href,
      icon: link.icon,
      group: section.title,
      keywords: link.keywords,
    })),
  );
}
