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
      connectorItem("connector-host", "RTX-Verbindung", "/connector", "plug", ["rtx", "verbindung", "token"]),
      connectorItem("connector-users", "Benutzer & Owner", "/users", "users", ["benutzer", "user", "owner", "konto", "account", "einrichten"]),
      connectorItem("connector-cloudflare", "Cloudflare-Tunnel", "/cloudflare", "cloud", ["cloudflare", "tunnel", "cloudflared", "öffentlich", "public", "domain"]),
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
