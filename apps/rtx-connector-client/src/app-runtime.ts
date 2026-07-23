import type { ConnectorRuntimeStatus } from "./lib/tauri";

/** Navigable sections of the Command Center shell. */
export type ConnectorPath =
  | "/"
  | "/connector"
  | "/users"
  | "/cloudflare"
  | "/deployment"
  | "/runner"
  | "/models"
  | "/printers"
  | "/jobs"
  | "/logs"
  | "/diagnostics";

export const INITIAL_RUNTIME_STATUS: ConnectorRuntimeStatus = {
  status: "stopped",
  message: "Connector ist gestoppt.",
  connectionStatus: "not_configured",
  lastHeartbeatAt: null,
};
