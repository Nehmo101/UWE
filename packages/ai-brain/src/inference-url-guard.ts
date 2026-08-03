/**
 * Blocks public Ollama/LM Studio endpoints unless explicitly allowed.
 * Maschinenraum inference must stay on private/home-network addresses.
 *
 * The implementation now lives in the low-level `@uwe/security` layer
 * (`@uwe/security/inference`). This module re-exports it so existing
 * `@uwe/ai-brain/inference-url-guard` importers keep working unchanged.
 */
export {
  classifyInferenceUrl,
  isInferenceUrlAllowed,
  assertInferenceUrlAllowed,
  sanitizeInferenceEndpointLabel,
  InferenceUrlBlockedError,
} from "@uwe/security/inference";
export type { InferenceUrlKind } from "@uwe/security/inference";
