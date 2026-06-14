import type {
  AiContext,
  AiProviderId,
  AiTaskType,
  ApiKeyStore,
  BuildAiContextOptions,
  GenerateTextResult,
} from "../types";

/** High-level provider routing mode (UI / API). */
export type AiProviderMode = "auto" | "local_rtx" | "cloud";

/** Which local context may be included in the prompt. */
export type AiContextMode =
  | "general_chat"
  | "brain"
  | "current_object"
  | "current_object_plus_brain"
  | "personal_brain";

/** Resolved backend route after provider selection. */
export type AiResolvedRoute = "local_rtx" | "cloud";

export interface AiRouterRequest {
  providerMode: AiProviderMode;
  contextMode: AiContextMode;
  taskType: AiTaskType;
  /** Required for local context modes; optional for general_chat-only cloud requests. */
  worldSlug?: string;
  /** Required for object/brain-object modes. */
  pageSlug?: string;
  sessionId?: string;
  userPrompt?: string;
  model?: string;
  /** Explicit cloud provider when providerMode is cloud or auto falls back to cloud. */
  cloudProviderId?: AiProviderId;
  allowDmOnly?: boolean;
  useMock?: boolean;
  options?: BuildAiContextOptions;
  apiKeyStore?: ApiKeyStore;
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

/** Context modes that must never be sent to a cloud provider. */
export const LOCAL_ONLY_CONTEXT_MODES: readonly AiContextMode[] = [
  "brain",
  "current_object",
  "current_object_plus_brain",
  "personal_brain",
] as const;

/** Only mode allowed when route resolves to cloud. */
export const CLOUD_ALLOWED_CONTEXT_MODES: readonly AiContextMode[] = ["general_chat"] as const;
