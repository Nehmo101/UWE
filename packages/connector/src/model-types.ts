/**
 * Model metadata shared between the UWE Host and the Maschinenraum.
 *
 * `ConnectorModelInfo` is the per-model payload sent on every heartbeat. The
 * connector only ever sends models the user has explicitly enabled for UWE
 * (`enabledForUwe`); the host stores them and surfaces the friendly metadata
 * (`displayName`, `description`, `bestFor`, `modelType`) in its model picker.
 *
 * No world/brain/personal data is ever carried here — only model descriptors.
 */

export const CONNECTOR_MODEL_TYPES = [
  "chat",
  "embedding",
  "vision",
  "image",
  "other",
] as const;

export type ConnectorModelType = (typeof CONNECTOR_MODEL_TYPES)[number];

const MODEL_TYPE_SET = new Set<string>(CONNECTOR_MODEL_TYPES);

export function isConnectorModelType(value: unknown): value is ConnectorModelType {
  return typeof value === "string" && MODEL_TYPE_SET.has(value);
}

/**
 * A model reported by the connector on a heartbeat. The discovery fields
 * (`status`, `contextLength`, `capabilities`) come from probing the local
 * provider; the curated fields come from the connector's model profile store.
 */
export interface ConnectorModelInfo {
  /**
   * Stable profile key (equal to `modelProfileKey(provider, name, path)` on the
   * connector). Used by the host to address a specific model in workflow
   * defaults and pickers. Optional for backwards compatibility with older
   * connectors that predate P5.
   */
  id?: string;
  /** Inference provider, e.g. "ollama", "lmstudio", "llamacpp", "filesystem". */
  provider: string;
  /** Technical model id used by the provider (or filename for filesystem models). */
  name: string;
  /** Live discovery status, when the model was matched to a running provider. */
  status?: string;
  contextLength?: number;
  capabilities?: string[];
  /** Friendly label shown in the host model picker. */
  displayName?: string;
  description?: string;
  /** Short use-case hints (e.g. "DnD generator", "Player-safe rewrite"). */
  bestFor?: string[];
  modelType?: ConnectorModelType;
  /** Always true for models that reach the host — only enabled models are sent. */
  enabledForUwe?: boolean;
}
