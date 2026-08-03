import type { AiTaskType } from "@uwe/security/inference";

export const AI_BRAIN_VERSION = "1.0.0";

/**
 * Die beiden lokalen Inferenz-Backends. Cloud-Anbieter (OpenAI, Anthropic,
 * Gemini, OpenRouter) sind mit N.3 ersatzlos entfallen — jede KI-Aktion läuft
 * über den Maschinenraum-Host.
 */
export type AiProviderId = "ollama" | "openai_compatible";

// The AI task taxonomy and the AI context shape now live in the low-level
// `@uwe/security` layer (`@uwe/security/inference`) so the security guards can
// classify/sanitize context without importing this feature package. They are
// re-exported here so `@uwe/ai-brain/types` consumers and the package barrel
// keep the same import paths and type identity.
export type {
  AiTaskType,
  AiContextBlock,
  AiContextRelation,
  AiContextBacklink,
  AiContextPage,
  AiContextSource,
  AiContextWorld,
  AiContextCampaign,
  AiContextBrainEntry,
  AiContextDebugItem,
  AiContextDebug,
  AiContextSession,
  AiContext,
} from "@uwe/security/inference";

/** Tasks that require or benefit from session context. */
export const SESSION_AWARE_TASKS: AiTaskType[] = [
  "summarize_session",
  "generate_player_recap",
  "find_open_threads",
  "prepare_next_session",
  "prepare_mail_draft",
];

/** Tasks that must never receive DM-only context (output is player-facing). */
export const PLAYER_SAFE_TASKS: AiTaskType[] = [
  "generate_player_recap",
  "create_player_handout",
  "prepare_mail_draft",
];

export interface AiModel {
  id: string;
  name: string;
  provider: AiProviderId;
  contextWindow?: number;
}

/**
 * How the answer must be shaped. `"json"` asks the provider to ENFORCE a JSON
 * object at protocol level where the protocol knows how (OpenAI-family
 * `response_format`, Ollama `format`, Gemini `responseMimeType`).
 *
 * Not every backend can: the Anthropic Messages API has no JSON mode, and the
 * Maschinenraum's `llm_generate` payload has no field for it. For those
 * the flag is a no-op and the prompt plus the router's single repair attempt
 * carry the weight. Nothing downstream may assume the answer IS JSON because
 * this was set — `parseModelJson` still has to succeed.
 */
export type GenerateResponseFormat = "text" | "json";

export interface GenerateTextOptions {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: GenerateResponseFormat;
}

export interface GenerateTextUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  provider: AiProviderId;
  finishReason?: string;
  usage?: GenerateTextUsage;
}

export interface AiHealthCheckResult {
  ok: boolean;
  provider: AiProviderId;
  message: string;
  latencyMs?: number;
}

export interface AiProviderSettings {
  id: AiProviderId;
  label: string;
  isLocal: boolean;
  enabled: boolean;
  baseUrl?: string;
  defaultModel?: string;
  hasApiKey: boolean;
}

export interface AiBrainSettings {
  enabled: boolean;
  datenschutzMode: boolean;
  localOnly: boolean;
  defaultProvider: AiProviderId;
  providers: AiProviderSettings[];
}

export interface BuildAiContextOptions {
  maxChars?: number;
  includeRelatedPageIds?: string[];
  datenschutzMode?: boolean;
  localOnly?: boolean;
  sessionId?: string;
  /** User/task text for semantic brain retrieval (reduces full-document dumps). */
  retrievalQuery?: string;
}

export interface ApiKeyStore {
  get(providerId: AiProviderId): string | undefined;
  set(providerId: AiProviderId, key: string): void;
  delete(providerId: AiProviderId): void;
  has(providerId: AiProviderId): boolean;
}

export interface AiProvider {
  readonly id: AiProviderId;
  readonly isLocal: boolean;
  listModels(): Promise<AiModel[]>;
  generateText(options: GenerateTextOptions): Promise<GenerateTextResult>;
  streamText?(options: GenerateTextOptions): AsyncIterable<string>;
  embedText?(text: string, model?: string): Promise<number[]>;
  healthCheck(): Promise<AiHealthCheckResult>;
}

export class AiPrivacyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiPrivacyError";
  }
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: AiProviderId,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
