/**
 * @uwe/connector-client-config — RTX Connector Client local settings.
 *
 * Types, defaults, validation, and UI helpers. No filesystem I/O; Tauri owns persistence.
 */

export {
  CONNECTOR_PROCESS_STATUSES,
  CONNECTOR_TRAY_MODES,
  ConnectorConnectionStatus,
  type ConnectorClientConfig,
  type ConnectorProcessState,
  type ConnectorProcessStatus,
  type ConnectorTrayMode,
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
