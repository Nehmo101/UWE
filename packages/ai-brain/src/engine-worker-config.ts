// Maschinenraum worker URL/config resolver (`ENGINE_BASE_URL` / `ENGINE_SERVICE_TOKEN`).
// The legacy inbound Maschinenraum *Agent* LLM client/provider was removed — ai-brain inference
// now uses direct Ollama/LM Studio (`AI_INFERENCE_BASE_URL`) and the outbound Maschinenraum.
// This module remains because the Maschinenraum worker security boundary
// (`@uwe/security` engine-boundary) and the Maschinenraum worker (image) path still resolve and
// LAN-validate the worker URL through it. See docs/removed-legacy-runtime.md.
//
// The implementation now lives in the low-level `@uwe/security` layer
// (`@uwe/security/inference`). This module re-exports it so existing
// `@uwe/ai-brain/engine-worker-config` importers keep working unchanged.
export {
  evaluateEngineWorkerUrl,
  resolveEngineWorkerConfig,
  isEngineWorkerConfigured,
} from "@uwe/security/inference";
export type {
  EngineWorkerStatus,
  EngineWorkerConfig,
  EngineWorkerHealthPayload,
  EngineWorkerUrlEvaluation,
} from "@uwe/security/inference";
