/**
 * @uwe/cookbook — native UWE local-model management, hardware fit, and runtime
 * diagnostics.
 *
 * Explicit named re-exports (not `export *`) so the barrel's value exports stay
 * detectable for every consumer — including ESM importers loaded through `tsx`
 * where Node's CJS named-export analysis cannot follow `export *` chains.
 */

export type {
  CookbookAiProviderMode,
  CookbookAiContextMode,
  CookbookAiTaskType,
  CookbookInferenceProbe,
  CookbookRtxProbe,
  CookbookRuntimeProbeInput,
} from "./ai-types";
export { COOKBOOK_LOCAL_ONLY_CONTEXT_MODES } from "./ai-types";

export type {
  CookbookEngineId,
  GpuBackend,
  CookbookUseCaseId,
  ModelFitLevel,
  QuantFormat,
  CookbookGpuInfo,
  CookbookGpuGroup,
  CookbookHardwareProfile,
  CookbookModelEntry,
  CookbookEngineDefinition,
  ModelFitResult,
  CookbookRecommendation,
  RuntimeEngineStatus,
  DockerDiagnostic,
  OllamaDiagnostic,
  ServeDiagnosis,
  CookbookRuntimeHealth,
  CookbookDashboard,
  CookbookRoutingHints,
} from "./types";

export { COOKBOOK_ENGINES, listCookbookEngines, getCookbookEngine } from "./engine-registry";

export {
  QUANT_BYTES_PER_PARAM,
  USE_CASE_LABELS,
  COOKBOOK_MODEL_REGISTRY,
  getCookbookModel,
  listCookbookModels,
  matchInstalledModel,
  estimateModelVramGb,
  estimateModelRamGb,
} from "./model-registry";

export { detectHardwareProfile } from "./hardware-profile";

export {
  computeModelFit,
  rankModelsForHardware,
  resolveModelFitById,
  USE_CASE_CONTEXT,
  USE_CASE_MIN_SCORE,
} from "./model-fit";

export {
  buildCookbookRecommendations,
  getRecommendationForUseCase,
  listCookbookSetupHints,
} from "./recommendations";

export { buildCookbookRuntimeHealth } from "./runtime-health";

export { diagnoseServeOutput, diagnoseRuntimeMessages } from "./diagnostics";

export {
  mapTaskToUseCase,
  isPrivateContextMode,
  buildCookbookRoutingHints,
  resolveCookbookModelForRequest,
} from "./routing-hints";

export type { CookbookServiceOptions } from "./cookbook-service";
export { getCookbookDashboard, getCookbookRoutingContext } from "./cookbook-service";
