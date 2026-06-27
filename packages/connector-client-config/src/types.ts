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
  /**
   * Privacy mode. When `true`, the connector reports only the minimal metadata
   * required for the host to route jobs (connector name, lanes, model ids) and
   * omits richer host-facing telemetry such as model descriptions, hardware
   * details and on-disk paths. Passed to the connector process as the
   * `UWE_CONNECTOR_PRIVACY_MODE` environment variable. Defaults to `false`.
   */
  privacyMode: boolean;
  /**
   * Spotify application client id used for the connector-local OAuth flow.
   * Spotify auth lives only on the RTX Connector Client — never on the host.
   * Empty until the user pastes their Spotify app credentials.
   */
  spotifyClientId: string;
  /** Spotify application client secret for the connector-local OAuth flow. */
  spotifyClientSecret: string;
  /**
   * Spotify OAuth redirect URI. Defaults to the loopback callback the client
   * listens on (`http://127.0.0.1:8742/callback`). Must match the URI
   * registered in the Spotify developer dashboard.
   */
  spotifyRedirectUri: string;
  /**
   * Local audio player command. Passed to the connector as
   * `UWE_CONNECTOR_AUDIO_CMD`; the source URL/path is appended as the final
   * argument. Empty disables local audio playback.
   */
  audioCommand: string;
  /**
   * Local image-generation command. Passed to the connector as
   * `UWE_CONNECTOR_IMAGE_CMD`; the job payload is provided on stdin as JSON.
   * Empty disables local image generation.
   */
  imageCommand: string;
}

/** Default Spotify OAuth redirect URI for the connector-local loopback flow. */
export const DEFAULT_SPOTIFY_REDIRECT_URI = "http://127.0.0.1:8742/callback";

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
