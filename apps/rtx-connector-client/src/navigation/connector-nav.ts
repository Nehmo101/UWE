/**
 * RTX Connector Client navigation — desktop client IA.
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

const SECTION = "Connector";

export const CONNECTOR_NAV: NavGroup[] = [
  {
    id: "connector-main",
    title: "Connector",
    items: [
      connectorItem("connector-host", "Host-Verbindung", "/", "plug", ["host", "verbindung", "token"]),
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
    group: "Connector",
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
