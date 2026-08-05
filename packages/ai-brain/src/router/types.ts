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
 * UWE runs on the Maschinenraum host. Cloud providers were removed entirely, so there is
 * no route to choose between and no privacy label to enforce.
 */
export type AiProviderMode = "local_engine";

/** Which local context may be included in the prompt. */
export type AiContextMode =
  | "general_chat"
  | "brain"
  | "current_object"
  | "current_object_plus_brain"
  | "personal_brain"
  | "mail";

/** Resolved backend route. Local Maschinenraum is the only backend. */
export type AiResolvedRoute = "local_engine";

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
  /**
   * Vorserialisierter Zusatz-Kontext (z. B. der Kampagnen-Digest aus dem
   * Kampagnen-Cockpit). Wird 1:1 an den Prompt-Kontext angehängt und zählt
   * gegen das Kontext-Budget.
   */
  extraPromptContext?: string;
  model?: string;
  useMock?: boolean;
  options?: BuildAiContextOptions;
  apiKeyStore?: ApiKeyStore;
  maxTokens?: number;
}

/**
 * What the JSON requirement did to this request. Present on every result so a
 * run record can answer "why is this answer prose?" without guessing:
 * `requested` false means the task never wanted JSON, `repairAttempted` true
 * with `ok` false means the model failed twice and the validators took over.
 */
export interface AiJsonModeReport {
  requested: boolean;
  repairAttempted: boolean;
  /** Whether the returned text parses as a JSON object. Only meaningful when `requested`. */
  ok: boolean;
}

export interface AiRouterResult {
  context: AiContext;
  result: GenerateTextResult;
  prompts: { systemPrompt: string; userPrompt: string };
  route: AiResolvedRoute;
  providerId: AiProviderId;
  contextMode: AiContextMode;
  providerMode: AiProviderMode;
  jsonMode: AiJsonModeReport;
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
export const AI_PROVIDER_MODE: AiProviderMode = "local_engine";
