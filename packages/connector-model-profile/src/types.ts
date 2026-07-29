/**
 * Persisted model profile store for the UWE Command Center.
 *
 * The connector discovers local models (Ollama / LM Studio / llama.cpp APIs and
 * `.gguf` files on disk) but only shares the ones the user explicitly enables.
 * A `ConnectorModelProfile` is the user-curated record for one model: friendly
 * metadata plus the enable/visibility flags. The store also remembers which
 * directories to scan for filesystem models.
 *
 * This package defines the shape, validation, and key helper only — the
 * connector tool owns reading/writing the JSON file.
 */

import type { ConnectorModelType } from "@uwe/connector";

export type { ConnectorModelType } from "@uwe/connector";
export { CONNECTOR_MODEL_TYPES } from "@uwe/connector";

/** Where a profile originated. */
export const CONNECTOR_MODEL_SOURCES = [
  /** Found by probing a running provider API (Ollama / LM Studio / llama.cpp). */
  "discovery",
  /** Found by scanning a configured directory for `.gguf` files. */
  "filesystem",
  /** Added or edited by the user. */
  "manual",
] as const;

export type ConnectorModelSource = (typeof CONNECTOR_MODEL_SOURCES)[number];

/** Current version of the persisted store schema. */
export const MODEL_PROFILE_STORE_VERSION = 1;

export interface ConnectorModelProfile {
  /** Stable key, equal to `modelProfileKey(provider, name, path)`. */
  id: string;
  /** Inference provider, e.g. "ollama", "lmstudio", "llamacpp", "filesystem". */
  provider: string;
  /** How this profile was first discovered. */
  source: ConnectorModelSource;
  /** Technical model id used by the provider (or filename for filesystem models). */
  name: string;
  /** Friendly label shown in the UWE model picker. */
  displayName: string;
  /** Free-text description of the model. */
  description: string;
  /** Short use-case hints, e.g. "DnD generator", "Player-safe rewrite". */
  bestFor: string[];
  /** Use-cases this model is explicitly not recommended for. */
  notRecommendedFor: string[];
  /** Coarse model category used for picker grouping and capability mapping. */
  modelType: ConnectorModelType;
  /** Absolute path for filesystem (`.gguf`) models; null for API-served models. */
  path: string | null;
  /** Source repository id (e.g. a Hugging Face repo) when known. */
  repoId: string | null;
  /** Whether this model is shared with the UWE Host on heartbeat. */
  enabledForUwe: boolean;
  /** Whether this model appears in the UWE model picker (when enabled). */
  visibleInModelPicker: boolean;
  /** Free-form tags for filtering/grouping. */
  tags: string[];
  /** Context window length in tokens, when known. */
  contextLength: number | null;
  /** Estimated VRAM footprint in GB, when known. */
  estimatedVramGb: number | null;
  /** On-disk size in bytes for filesystem models, when known. */
  sizeBytes: number | null;
}

/** A directory the connector scans for local `.gguf` model files. */
export interface ModelScanPath {
  /** Stable id for the path entry. */
  id: string;
  /** Absolute directory path to scan. */
  path: string;
  /** Whether this path is actively scanned. */
  enabled: boolean;
  /** Optional friendly label. */
  label: string | null;
}

export interface ConnectorModelProfileStore {
  version: number;
  profiles: ConnectorModelProfile[];
  scanPaths: ModelScanPath[];
}
