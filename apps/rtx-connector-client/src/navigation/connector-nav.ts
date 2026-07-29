/**
 * UWE Command Center navigation — all-in-one desktop operations.
 * Part of the central navigation contract (`@uwe/shared-utils/navigation`).
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

const SECTION = "Command Center";

export const CONNECTOR_NAV: NavGroup[] = [
  {
    id: "connector-main",
    title: "UWE Command Center",
    items: [
      connectorItem("command-center", "Command Center", "/", "layout-dashboard", ["start", "host", "hosting", "status", "setup"]),
      connectorItem("connector-host", "Maschinenraum", "/connector", "plug", ["maschinenraum", "rtx", "connector", "verbindung", "token", "gpu"]),
      connectorItem("connector-users", "Zugänge", "/users", "users", ["zugang", "zugaenge", "haekchen", "benutzer", "user", "owner", "konto", "account", "portal", "studio", "brain", "family", "einrichten"]),
      // Die Schlagwörter sind der eigentliche Weg hierher: Wer „Passkey" oder
      // „Turnstile" sucht, kennt weder den Reiter „Betrieb" noch die
      // Cloudflare-Seite. Neue Einstellung heißt: neues Schlagwort.
      connectorItem("connector-ops", "Betrieb", "/ops", "shield", ["betrieb", "security", "sicherheit", "secrets", "migrationen", "audit", "log", "api-token", "token", "webhooks", "einstellungen", "settings", "anmeldung", "login", "passkey", "passkeys", "webauthn", "face id", "touch id", "google-login", "auto-logout", "backup", "briefing", "notfallmodus", "wartungsmodus", "privatsphäre", "mail", "smtp", "speicher", "ki", "portal"]),
      connectorItem("connector-cloudflare", "Cloudflare", "/cloudflare", "cloud", ["cloudflare", "tunnel", "cloudflared", "öffentlich", "public", "domain", "dns", "routen", "turnstile", "captcha", "bot", "botschutz", "challenge", "waf", "menschprüfung"]),
      connectorItem("connector-deployment", "Deployment", "/deployment", "settings", ["deployment", "env", "ports", "url", "smtp", "mail", "ki", "einstellungen", "config"]),
      connectorItem("connector-runner", "Runner / Ollama", "/runner", "cpu", ["runner", "ollama", "llm"]),
      connectorItem("connector-models", "Modelle", "/models", "boxes", ["modelle", "models"]),
      connectorItem("connector-printers", "Drucker", "/printers", "printer", ["drucker", "printer", "label"]),
      connectorItem("connector-jobs", "Jobs", "/jobs", "list-checks", ["jobs", "queue"]),
      connectorItem("connector-logs", "Logs", "/logs", "scroll-text", ["logs"]),
      connectorItem("connector-diagnostics", "Diagnose", "/diagnostics", "stethoscope", ["diagnose", "diagnostics"]),
    ],
  },
];

function connectorItem(
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
    group: "Command Center",
    section: SECTION,
    permission: ["owner"],
    status: "active",
    source: "connector",
    keywords,
  };
}

/** Connector sidebar groups with active flags resolved for the current path. */
export function connectorSidebar(activePath: string): ResolvedNavGroup[] {
  return resolveNavGroups(CONNECTOR_NAV, activePath);
}

/** Flat list of connector nav items. */
export function connectorNavItems(): NavItem[] {
  return flattenNavGroups(CONNECTOR_NAV);
}

/** Duplicate detection for connector nav (for tests). */
export function connectorNavConflicts(): NavConflicts {
  return findNavConflicts(connectorNavItems());
}
