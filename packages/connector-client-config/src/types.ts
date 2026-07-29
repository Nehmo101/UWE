/**
 * Persisted local settings for the UWE Command Center (Tauri desktop app).
 * This package defines the shape and validation only — persistence is handled by Tauri.
 */

export const CONNECTOR_TRAY_MODES = ["normal", "minimize_to_tray", "start_in_tray"] as const;
export type ConnectorTrayMode = (typeof CONNECTOR_TRAY_MODES)[number];

export const CONNECTOR_TRANSPORT_MODES = ["queue", "direct", "hybrid"] as const;
export type ConnectorTransportMode = (typeof CONNECTOR_TRANSPORT_MODES)[number];

export interface ConnectorClientConfig {
  /** UWE Host base URL (http/https, no trailing slash). */
  hostUrl: string;
  /** Connector bearer token (`uwec_…`). May be empty before setup completes. */
  token: string;
  /** Friendly label shown in the host UI. */
  name: string;
  /** Preferred delivery transport. Missing persisted values migrate to queue. */
  transportMode: ConnectorTransportMode;
  /** Compatibility projection. Prefer `transportMode` in new code. */
  queueEnabled: boolean;
  /** Connection wizard (host URL, token, name) has been completed or dismissed. */
  wizardCompleted: boolean;
  /**
   * First-run install wizard ("Was soll installiert werden?") has been completed
   * or explicitly postponed. Separate from `wizardCompleted`: one sets up the
   * local UWE installation, the other the outbound Maschinenraum connection.
   */
  installWizardCompleted: boolean;
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
   * Spotify auth lives only on the Command Center — never on the host.
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
  /**
   * Local speech-to-text command. Passed to the connector as
   * `UWE_CONNECTOR_STT_CMD`; the job payload is provided on stdin as JSON
   * (`{audioPath, mimeType, language, model}`) and a `{text, model}` JSON object
   * is expected on stdout. Empty disables local dictation.
   */
  sttCommand: string;
  /**
   * Local label-print command. Passed to the connector as
   * `UWE_CONNECTOR_PRINT_CMD`; called with `--printer <id> --file <path>` when
   * a `label_print` job arrives. Empty lets the connector fall back to a
   * native OS print (Windows: ShellExecute "print to"; else CUPS `lp`).
   */
  printCommand: string;
  /**
   * Id of the printer picked as the default target for local test prints in
   * the RTX Client's printer picker. Purely a local UX convenience — real
   * `label_print` jobs always carry their own explicit printer id from Studio.
   */
  defaultPrinterId: string;
  /** UWE checkout used by the integrated local host controller. */
  localHostRoot: string;
  /**
   * Start local Studio, Portal and Brain automatically with the Command Center.
   * Opt-in keeps existing remote-host connector installations safe.
   */
  autoStartHost: boolean;
  /** Start the Cloudflare tunnel connector automatically with the Command Center. */
  autoStartTunnel: boolean;
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
