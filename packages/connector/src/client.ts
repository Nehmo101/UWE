/**
 * Browser-safe @uwe/connector exports — no Node.js built-ins.
 * Import from here in "use client" components.
 */

export {
  CONNECTOR_CAPABILITIES,
  CONNECTOR_CAPABILITY_LABELS,
  isConnectorCapability,
  normalizeCapabilities,
  type ConnectorCapability,
} from "./capabilities";

export {
  CONNECTOR_OFFLINE_MESSAGE,
  capabilityOfflineMessage,
} from "./degraded";
