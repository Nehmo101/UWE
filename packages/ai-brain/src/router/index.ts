export {
  routeAiRequest,
  resolveProviderRoute,
  providerIdToMode,
  legacyContextMode,
  type AiRouterDeps,
} from "./aiRouter";

export {
  validateProviderContextCombination,
  validateResolvedRouteForContext,
  validateContextModeRequirements,
  validateLocalRtxRequired,
  contextModeRequiresLocalContext,
  isCloudRouteAllowedForContext,
} from "./privacyGuard";

export {
  type AiProviderMode,
  type AiContextMode,
  type AiResolvedRoute,
  type AiRouterRequest,
  type AiRouterResult,
  type ProviderResolution,
  AiRouterError,
  LOCAL_ONLY_CONTEXT_MODES,
  CLOUD_ALLOWED_CONTEXT_MODES,
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
  createCloudProvider,
  resolveCloudProviderId,
  listAvailableCloudProviders,
  type CloudProviderOptions,
} from "./providers/cloudProvider";

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
  type ConnectorVisionInput,
  type ConnectorVisionResult,
} from "./providers/connectorQueueProvider";
