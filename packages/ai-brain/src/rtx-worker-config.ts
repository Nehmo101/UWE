// RTX worker URL/config resolver (`RTX_BASE_URL` / `RTX_SERVICE_TOKEN`).
// The legacy inbound RTX *Agent* LLM client/provider was removed — ai-brain inference
// now uses direct Ollama/LM Studio (`AI_INFERENCE_BASE_URL`) and the outbound RTX Host
// Connector. This module remains because the RTX worker security boundary
// (`@uwe/security` rtx-boundary) and the RTX worker (image) path still resolve and
// LAN-validate the worker URL through it. See docs/removed-legacy-runtime.md.
//
// The implementation now lives in the low-level `@uwe/security` layer
// (`@uwe/security/inference`). This module re-exports it so existing
// `@uwe/ai-brain/rtx-worker-config` importers keep working unchanged.
export {
  evaluateRtxWorkerUrl,
  resolveRtxWorkerConfig,
  isRtxWorkerConfigured,
} from "@uwe/security/inference";
export type {
  RtxWorkerStatus,
  RtxWorkerConfig,
  RtxWorkerHealthPayload,
  RtxWorkerUrlEvaluation,
} from "@uwe/security/inference";
