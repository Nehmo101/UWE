/**
 * System area navigation — was von Studios Betriebsfläche übrig ist.
 *
 * Betrieb und Einrichtung laufen nicht mehr im Browser: der System-Hub liegt in
 * Brain (`/system`), Host-Setup, Cloudflare, Maschinenraum-Verbindung, Drucker, Secrets,
 * Migrationen, Tokens, Webhooks, Einstellungen und Backups laufen über die
 * Kommandozentrale auf dem UWE-Host (Notiz Lasse, Abschnitt D).
 *
 * Übrig bleibt das eigene Konto. Die Gruppe „Übersicht" (Admin-Hub, Verlauf,
 * NL-Befehle) und „Design & Theme" standen hier noch — beides ist aus der
 * Seitenleiste gefallen: der Admin-Hub ist eine Betriebsfläche und keine
 * Arbeitsfläche, das Erscheinungsbild stellt man einmal ein und nicht täglich.
 * Die Routen bleiben und sind über die Befehlspalette erreichbar
 * (`STUDIO_PALETTE_EXTRA`). Tags liegen im Welt-Cockpit (D30).
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
      { href: "/admin/ai-prompt", label: "AI-Prompt" },
      {
        href: "/admin/character-creator-progress",
        label: "Charakter-Ersteller Fortschritt",
      },
    ],
  },
  {
    title: "Betrieb",
    links: [
      { href: "/admin/activity", label: "Verlauf" },
      // „Mail Center" auf `/mail` stand hier noch — die Route gibt es in Studio
      // nicht mehr, das Postfach liegt seit H10 in Brain (`/mail` auf :3002).
      { href: "/worlds", label: "Welten verwalten", primary: true },
    ],
  },
] as const;

export const SYSTEM_NAV: NavGroup[] = [
  {
    id: "system-settings",
    title: "Einstellungen",
    items: [
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
