/**
 * System area navigation — was von Studios Betriebsfläche übrig ist.
 *
 * Betrieb und Einrichtung laufen nicht mehr im Browser: der System-Hub liegt in
 * Brain (`/system`), Host-Setup, Cloudflare, RTX-Verbindung, Drucker, Secrets,
 * Migrationen, Tokens, Webhooks, Einstellungen und Backups laufen über die
 * Kommandozentrale auf dem UWE-Host (Notiz Lasse, Abschnitt D).
 *
 * Was hier bleibt, sind die Studio-eigenen Flächen: KI-Governance, der Verlauf,
 * Tags, Design und das eigene Konto.
 *
 * Part of the central navigation contract (see ./types.ts).
 */
import type { NavGroup } from "./types";

const SECTION = "System";

export const ADMIN_HUB_SECTIONS = [
  {
    title: "Content & KI",
    links: [
      { href: "/admin/ai-gateway", label: "KI-Gateway" },
      { href: "/admin/agent-jobs", label: "Agent Jobs" },
      { href: "/admin/ai-prompt", label: "AI-Prompt" },
    ],
  },
  {
    title: "Betrieb",
    links: [
      { href: "/admin/activity", label: "Verlauf" },
      { href: "/hardware", label: "Hardware-Cockpit" },
      { href: "/mail", label: "Mail Center" },
      { href: "/worlds", label: "Welten verwalten", primary: true },
    ],
  },
] as const;

export const SYSTEM_NAV: NavGroup[] = [
  {
    id: "system-overview",
    title: "Übersicht",
    items: [
      {
        id: "system-admin",
        label: "Admin Übersicht",
        href: "/admin",
        icon: "layout-dashboard",
        group: "Übersicht",
        section: SECTION,
        permission: ["owner", "admin"],
        status: "active",
        source: "system",
        keywords: ["admin"],
      },
      {
        id: "system-activity",
        label: "Verlauf",
        href: "/admin/activity",
        icon: "history",
        group: "Übersicht",
        section: SECTION,
        permission: ["owner", "admin"],
        status: "active",
        source: "system",
        keywords: ["activity", "audit", "verlauf"],
      },
      {
        id: "system-command-center",
        label: "NL-Befehle",
        href: "/command",
        icon: "terminal",
        group: "Übersicht",
        section: SECTION,
        permission: ["owner", "admin"],
        status: "active",
        source: "system",
        keywords: ["command", "nl", "befehl", "intent", "admin", "nl-befehle"],
      },
    ],
  },
  {
    id: "system-operations",
    title: "Betrieb",
    items: [
      {
        id: "system-tags",
        label: "Tags",
        href: "/admin/tags",
        icon: "tags",
        group: "Betrieb",
        section: SECTION,
        permission: ["owner", "admin"],
        status: "active",
        source: "system",
        keywords: ["tags"],
      },
    ],
  },
  {
    id: "system-settings",
    title: "Einstellungen",
    items: [
      {
        id: "system-settings",
        label: "Design & Theme",
        href: "/settings",
        icon: "settings",
        group: "Einstellungen",
        section: SECTION,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "system",
        keywords: ["settings", "einstellungen", "erscheinungsbild", "theme", "design"],
      },
      {
        id: "system-account-password",
        label: "Passwort",
        href: "/account/password",
        icon: "lock",
        group: "Einstellungen",
        section: SECTION,
        permission: ["owner", "admin", "dm", "player", "readonly"],
        status: "active",
        source: "system",
        keywords: ["passwort", "account"],
      },
      {
        id: "system-account-security",
        label: "Sicherheit (2FA)",
        href: "/account/security",
        icon: "shield-check",
        group: "Einstellungen",
        section: SECTION,
        permission: ["owner", "admin", "dm", "player", "readonly"],
        status: "active",
        source: "system",
        keywords: ["2fa", "sicherheit", "account"],
      },
    ],
  },
];
