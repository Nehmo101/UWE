/**
 * Persisted local settings for the UWE RTX Connector Client (Tauri desktop app).
 * This package defines the shape and validation only — persistence is handled by Tauri.
 */

export const CONNECTOR_TRAY_MODES = ["normal", "minimize_to_tray", "start_in_tray"] as const;
export type ConnectorTrayMode = (typeof CONNECTOR_TRAY_MODES)[number];

export interface ConnectorClientConfig {
  /** UWE Host base URL (http/https, no trailing slash). */
  hostUrl: string;
  /** Connector bearer token (`uwec_…`). May be empty before setup completes. */
  token: string;
  /** Friendly label shown in the host UI. */
  name: string;
  /** Whether this client claims jobs from the host queue. */
  queueEnabled: boolean;
  /** First-run setup wizard has been completed. */
  wizardCompleted: boolean;
  /** Connect to the host automatically when the client starts. */
  autoConnect: boolean;
  /** Start the client window minimized. */
  minimizedStart: boolean;
  /** Register a Windows autostart entry (Windows only; no-op elsewhere). */
  autostartWindows: boolean;
  /** How the client behaves with the system tray. */
  trayMode: ConnectorTrayMode;
}

export const ConnectorConnectionStatus = {
  NotConfigured: "not_configured",
  Ready: "ready",
  Connecting: "connecting",
  Connected: "connected",
  Degraded: "degraded",
  Disconnected: "disconnected",
  Error: "error",
} as const;

export type ConnectorConnectionStatus =
  (typeof ConnectorConnectionStatus)[keyof typeof ConnectorConnectionStatus];

export const CONNECTOR_PROCESS_STATUSES = [
  "running",
  "stopped",
  "starting",
  "stopping",
  "error",
] as const;

export type ConnectorProcessState = (typeof CONNECTOR_PROCESS_STATUSES)[number];

export interface ConnectorProcessStatus {
  status: ConnectorProcessState;
  message?: string;
}
