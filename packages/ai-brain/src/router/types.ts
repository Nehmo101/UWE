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
  | "personal_brain"
  | "mail";

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

/**
 * Context modes that must NEVER be sent to a cloud provider.
 * personal_brain and mail (private inbox content) are hard-blocked;
 * DnD/world modes may go to cloud when admin gateway policy permits
 * (DEFAULT_PRIVACY_RULES.dnd_world = CLOUD_ALLOWED).
 */
export const LOCAL_ONLY_CONTEXT_MODES: readonly AiContextMode[] = [
  "personal_brain",
  "mail",
] as const;

/**
 * Context modes that may be routed to cloud when gateway policy allows.
 * personal_brain and mail are excluded — they are permanently local-only.
 */
export const CLOUD_ALLOWED_CONTEXT_MODES: readonly AiContextMode[] = [
  "general_chat",
  "brain",
  "current_object",
  "current_object_plus_brain",
] as const;
