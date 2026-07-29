/**
 * @uwe/connector — shared core for the UWE Host ↔ Maschinenraum model.
 *
 * The host is the source of truth: it owns the queue, the worker registry and
 * the connector tokens. The Maschinenraum is an optional outbound worker.
 * This package holds only framework-agnostic logic shared by both sides.
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

export {
  LABEL_PRINT_FORMATS,
  isLabelPrintFormat,
  labelPrintDocumentPath,
  normalizeLocalPrinters,
  parseLabelPrintJobPayload,
  type LabelPrintFormat,
  type LabelPrintJobPayload,
  type LocalPrinterInfo,
  type PrinterDiscoverResult,
} from "./label-printing";

export {
  CONNECTOR_MODEL_TYPES,
  isConnectorModelType,
  type ConnectorModelInfo,
  type ConnectorModelType,
} from "./model-types";

export {
  CONNECTOR_JOB_TYPES,
  CONNECTOR_JOB_DESCRIPTORS,
  CONNECTOR_LANES,
  LANE_CONCURRENCY,
  capabilityForJobType,
  defaultPriorityForJobType,
  describeConnectorJob,
  isConnectorJobType,
  laneForJobType,
  type ConnectorJobDescriptor,
  type ConnectorJobType,
  type ConnectorLane,
} from "./job-types";

export {
  CONNECTOR_TOKEN_PREFIX,
  connectorTokenHashesEqual,
  generateConnectorToken,
  hashConnectorToken,
  looksLikeConnectorToken,
  parseConnectorBearer,
  verifyConnectorToken,
} from "./token";

export {
  CONNECTOR_TRANSPORT_MODES,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_RUNTIME_ROLE,
  UWE_RUNTIME_ROLES,
  isConnectorRole,
  isConnectorTransportMode,
  isHostRole,
  resolveConnectorRuntimeConfig,
  resolveRuntimeRole,
  type ConnectorRuntimeConfig,
  type ConnectorRuntimeConfigResult,
  type ConnectorTransportMode,
  type UweRuntimeRole,
} from "./runtime-role";

export {
  DIRECT_PROTOCOL_VERSION,
  isDirectProtocolFrame,
  parseDirectProtocolFrame,
  type DirectAcceptedFrame,
  type DirectCancelFrame,
  type DirectConnectorEvent,
  type DirectErrorFrame,
  type DirectHostFrame,
  type DirectPingFrame,
  type DirectProgressFrame,
  type DirectProtocolFrame,
  type DirectRequestFrame,
  type DirectResultFrame,
} from "./direct-protocol";

export {
  CONNECTOR_JOB_STATUSES,
  CONNECTOR_STATUSES,
  DEFAULT_JOB_TTL_MS,
  DEFAULT_ONLINE_WINDOW_MS,
  canClaimJob,
  defaultExpiryForJobType,
  deriveConnectorStatus,
  isConnectorOnline,
  isJobExpired,
  selectNextJob,
  type ClaimContext,
  type ClaimableJobView,
  type ConnectorHeartbeatView,
  type ConnectorJobStatus,
  type ConnectorStatus,
} from "./queue-logic";
