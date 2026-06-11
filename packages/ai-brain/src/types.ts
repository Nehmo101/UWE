export const AI_BRAIN_VERSION = "1.0.0";

export type AiProviderId =
  | "ollama"
  | "openai_compatible"
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter";

export type AiTaskType =
  | "summarize_page"
  | "summarize_session"
  | "generate_player_recap"
  | "suggest_links"
  | "suggest_backlinks"
  | "detect_contradictions"
  | "find_open_threads"
  | "create_npc"
  | "create_location"
  | "create_encounter"
  | "improve_lore_text"
  | "prepare_canon_check";

/** Tasks that require or benefit from session context. */
export const SESSION_AWARE_TASKS: AiTaskType[] = [
  "summarize_session",
  "generate_player_recap",
  "find_open_threads",
];

/** Tasks that must never receive DM-only context (output is player-facing). */
export const PLAYER_SAFE_TASKS: AiTaskType[] = ["generate_player_recap"];

export interface AiModel {
  id: string;
  name: string;
  provider: AiProviderId;
  contextWindow?: number;
}

export interface GenerateTextOptions {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  provider: AiProviderId;
  finishReason?: string;
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

export interface AiContextBlock {
  blockId: string;
  type: string;
  visibility: string;
  content: string;
}

export interface AiContextRelation {
  targetPageId: string;
  targetTitle: string;
  relationType: string;
  label?: string | null;
  direction: "outgoing" | "incoming";
}

export interface AiContextBacklink {
  sourcePageId: string;
  sourceTitle: string;
}

export interface AiContextPage {
  pageId: string;
  title: string;
  pageType: string;
  tags: string[];
  aliases: string[];
  visibility: string;
  canonicalStatus: string;
  summary?: string | null;
  contentBlocks: AiContextBlock[];
  relations: AiContextRelation[];
  backlinks: AiContextBacklink[];
}

export interface AiContextSource {
  pageId: string;
  blockIds?: string[];
}

export interface AiContextSession {
  sessionId: string;
  title: string;
  sessionNumber: number;
  date?: string | null;
  status: string;
  summaryDm?: string | null;
  summaryPlayer?: string | null;
  notes?: string | null;
  openPlots?: string | null;
  playerDecisions?: string | null;
  linkedPageIds: string[];
}

export interface AiContext {
  taskType: AiTaskType;
  worldId: string;
  primaryPageId: string;
  sessionId?: string;
  session?: AiContextSession;
  pages: AiContextPage[];
  sources: AiContextSource[];
  promptContext: string;
  truncated: boolean;
  datenschutzMode: boolean;
  allowDmOnly: boolean;
}

export interface BuildAiContextOptions {
  allowDmOnly?: boolean;
  maxChars?: number;
  includeRelatedPageIds?: string[];
  datenschutzMode?: boolean;
  localOnly?: boolean;
  sessionId?: string;
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
