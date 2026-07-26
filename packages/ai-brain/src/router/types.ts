import type {
  AiContext,
  AiProviderId,
  AiTaskType,
  ApiKeyStore,
  BuildAiContextOptions,
  GenerateTextResult,
} from "../types";

/**
 * High-level provider routing mode. Only one value remains: every AI action in
 * UWE runs on the RTX host. Cloud providers were removed entirely, so there is
 * no route to choose between and no privacy label to enforce.
 */
export type AiProviderMode = "local_rtx";

/** Which local context may be included in the prompt. */
export type AiContextMode =
  | "general_chat"
  | "brain"
  | "current_object"
  | "current_object_plus_brain"
  | "personal_brain"
  | "mail";

/** Resolved backend route. Local RTX is the only backend. */
export type AiResolvedRoute = "local_rtx";

export interface AiRouterRequest {
  providerMode: AiProviderMode;
  contextMode: AiContextMode;
  taskType: AiTaskType;
  /** Required for world-scoped context modes. */
  worldSlug?: string;
  /** Required for object/brain-object modes. */
  pageSlug?: string;
  sessionId?: string;
  userPrompt?: string;
  model?: string;
  allowDmOnly?: boolean;
  useMock?: boolean;
  options?: BuildAiContextOptions;
  apiKeyStore?: ApiKeyStore;
  maxTokens?: number;
}

export interface AiRouterResult {
  context: AiContext;
  result: GenerateTextResult;
  prompts: { systemPrompt: string; userPrompt: string };
  route: AiResolvedRoute;
  providerId: AiProviderId;
  contextMode: AiContextMode;
  providerMode: AiProviderMode;
}

export interface ProviderResolution {
  route: AiResolvedRoute;
  providerId: AiProviderId;
}

export class AiRouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiRouterError";
  }
}

/** The only provider mode; kept as a constant so callers need not spell it out. */
export const AI_PROVIDER_MODE: AiProviderMode = "local_rtx";
