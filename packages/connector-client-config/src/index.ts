/**
 * @uwe/connector-client-config — RTX Connector Client local settings.
 *
 * Types, defaults, validation, and UI helpers. No filesystem I/O; Tauri owns persistence.
 */

export {
  CONNECTOR_PROCESS_STATUSES,
  CONNECTOR_TRAY_MODES,
  CONNECTOR_TRANSPORT_MODES,
  ConnectorConnectionStatus,
  DEFAULT_SPOTIFY_REDIRECT_URI,
  type ConnectorClientConfig,
  type ConnectorProcessState,
  type ConnectorProcessStatus,
  type ConnectorTrayMode,
  type ConnectorTransportMode,
} from "./types";

export {
  ConnectorClientConfigError,
  defaultConnectorClientConfig,
  parseConnectorClientConfig,
} from "./config";

export { maskToken } from "./mask-token";

export {
  validateHostUrl,
  type HostUrlValidationError,
  type HostUrlValidationOk,
  type HostUrlValidationResult,
} from "./validate-host-url";
