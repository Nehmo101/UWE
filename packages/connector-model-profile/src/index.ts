/**
 * @uwe/connector-model-profile — curated model metadata for the Maschinenraum.
 * Defines the persisted store shape (`ConnectorModelProfile`,
 * `ModelScanPath`), validation/parse helpers, and the stable profile key used
 * to match persisted profiles against freshly discovered models.
 *
 * No filesystem I/O lives here — the connector tool owns reading/writing JSON.
 */

export {
  CONNECTOR_MODEL_SOURCES,
  CONNECTOR_MODEL_TYPES,
  MODEL_PROFILE_STORE_VERSION,
  type ConnectorModelProfile,
  type ConnectorModelProfileStore,
  type ConnectorModelSource,
  type ConnectorModelType,
  type ModelScanPath,
} from "./types";

export { modelProfileKey } from "./key";

export {
  ConnectorModelProfileError,
  createModelProfile,
  defaultModelProfileStore,
  enabledProfiles,
  parseModelProfileStore,
  type CreateModelProfileInput,
} from "./store";
