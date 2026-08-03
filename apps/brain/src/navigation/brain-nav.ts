/**
 * Navigations-Kontrakt der Brain-App.
 *
 * Eine Quelle für Sidebar (`BrainNav`) und Suchleiste (`BrainNavSearch`) —
 * genauso wie Studio und Portal ihre IA aus einem Modul speisen. Brain nutzt
 * keine Icon-Bibliothek, `icon` ist deshalb eine Textglyphe.
 */
import type { NavSearchEntry } from "@uwe/shared-ui";

export interface BrainNavLink {
  href: string;
  label: string;
  /** Textglyphe (Brain rendert Icons als Zeichen, nicht als SVG). */
  icon: string;
  /** Synonyme für die Bereichssuche. */
  keywords?: string[];
}

export interface BrainNavSection {
  title: string;
  links: BrainNavLink[];
}

export const BRAIN_NAV_SECTIONS: BrainNavSection[] = [
  {
    title: "Überblick",
    links: [
      { href: "/", label: "Start", icon: "◆", keywords: ["start", "home", "übersicht"] },
      { href: "/today", label: "Heute", icon: "☀", keywords: ["today", "tag", "agenda", "cockpit"] },
      {
        href: "/life-brain",
        label: "Wissen",
        icon: "✦",
        keywords: ["life brain", "knowledge", "notizen", "fakten", "brain"],
      },
      {
        href: "/ki-chat",
        label: "KI-Chat",
        icon: "◈",
        keywords: ["ki", "ai", "chat", "assistent", "frage", "llm"],
      },
      {
        href: "/capture",
        label: "Capture",
        icon: "✎",
        keywords: ["erfassen", "inbox", "notiz", "schnell", "idee"],
      },
    ],
  },
  {
    title: "Machen",
    links: [
      { href: "/projects", label: "Projekte", icon: "▤", keywords: ["projects", "vorhaben", "aufgaben"] },
      {
        href: "/workshop",
        label: "Werkstatt",
        icon: "⚒",
        keywords: ["workshop", "3d druck", "terrain", "basteln"],
      },
      {
        href: "/miniatures",
        label: "Miniaturen",
        icon: "♟",
        keywords: ["miniatures", "minis", "bemalen", "figuren"],
      },
    ],
  },
  {
    title: "Verwaltung",
    links: [
      { href: "/hardware", label: "Hardware", icon: "▣", keywords: ["geräte", "devices", "inventar"] },
      { href: "/mail", label: "Mail", icon: "✉", keywords: ["email", "postfach", "nachrichten"] },
      {
        href: "/system",
        label: "System",
        icon: "⚙",
        keywords: ["status", "homelab", "diagnose", "host", "betrieb", "engine", "cloudflare"],
      },
    ],
  },
];

/** Durchsuchbare Bereiche für die Suchleiste in der Brain-Topbar. */
export function brainSearchEntries(): NavSearchEntry[] {
  return BRAIN_NAV_SECTIONS.flatMap((section) =>
    section.links.map((link) => ({
      id: `brain${link.href === "/" ? "-start" : link.href.replace(/\//g, "-")}`,
      label: link.label,
      href: link.href,
      icon: link.icon,
      group: section.title,
      keywords: link.keywords,
    })),
  );
}
