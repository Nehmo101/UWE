export {
  routeAiRequest,
  resolveProviderRoute,
  providerIdToMode,
  legacyContextMode,
  type AiRouterDeps,
} from "./aiRouter";

export {
  validateContextModeRequirements,
  validateLocalEngineRequired,
  contextModeLabel,
} from "./privacyGuard";

export {
  type AiProviderMode,
  type AiContextMode,
  type AiResolvedRoute,
  type AiRouterRequest,
  type AiRouterResult,
  type ProviderResolution,
  AiRouterError,
  AI_PROVIDER_MODE,
} from "./types";

export { buildRouterContext, type RouterContextBuildInput } from "./context/contextBuilder";
export {
  createBrainRetrievalAdapter,
  createDbBrainKnowledgeSource,
  type BrainRetrievalAdapterOptions,
} from "./context/brainRetrieval";

export {
  createLocalEngineProvider,
  getLocalEngineProviderId,
  assertLocalEngineReady,
  type LocalEngineProviderOptions,
} from "./providers/localEngineProvider";

export {
  checkEngineHealth,
  isEngineReady,
  isEngineWorkerConfigured,
  type EngineHealthStatus,
} from "./health/engineHealthcheck";

export {
  checkEngineReadiness,
  isEngineReadinessReady,
  type EngineReadinessStatus,
  type EngineReadinessOptions,
  type EngineReadinessSource,
} from "./health/engineReadiness";

export {
  isConnectorVisionAvailable,
  runConnectorVisionExtract,
  isConnectorLlmAvailable,
  runConnectorLlmGenerate,
  isConnectorSttAvailable,
  runConnectorAudioTranscribe,
  type ConnectorVisionInput,
  type ConnectorVisionResult,
  type ConnectorLlmInput,
  type ConnectorLlmResult,
  type ConnectorTranscribeInput,
  type ConnectorTranscribeResult,
} from "./providers/connectorQueueProvider";
