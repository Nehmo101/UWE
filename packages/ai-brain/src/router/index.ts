export {
  routeAiRequest,
  resolveProviderRoute,
  providerIdToMode,
  legacyContextMode,
  type AiRouterDeps,
} from "./aiRouter";

export {
  validateContextModeRequirements,
  validateLocalRtxRequired,
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
  createLocalRtxProvider,
  getLocalRtxProviderId,
  assertLocalRtxReady,
  type LocalRtxProviderOptions,
} from "./providers/localRtxProvider";

export {
  checkRtxHealth,
  isRtxReady,
  isRtxWorkerConfigured,
  type RtxHealthStatus,
} from "./health/rtxHealthcheck";

export {
  checkRtxReadiness,
  isRtxReadinessReady,
  type RtxReadinessStatus,
  type RtxReadinessOptions,
  type RtxReadinessSource,
} from "./health/rtxReadiness";

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
