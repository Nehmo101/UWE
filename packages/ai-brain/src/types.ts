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
  | "create_knowledge_text"
  | "improve_lore_text"
  | "suggest_page_tags"
  | "page_ai_convert"
  | "prepare_canon_check"
  | "prepare_next_session"
  | "create_player_handout"
  | "fill_dungeon_room"
  | "prepare_mail_draft"
  | "atlas_name_region"
  | "atlas_describe_region"
  | "simulate_faction"
  | "generate_structured_npc"
  | "generate_structured_quest"
  | "generate_structured_item"
  | "answer_life_question"
  | "synthesize_research"
  | "summarize_mail"
  | "prioritize_mail"
  | "generate_briefing"
  | "answer_mail_question";

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

/** Audience for context visibility filtering. */
export type ContextAudience = "dm_internal" | "player_visible" | "mail";

export type BrainVisibility = "dm_only" | "player_visible" | "public";

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
  brainEntryId?: string;
}

export interface AiContextWorld {
  worldId: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface AiContextCampaign {
  campaignId: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface AiContextBrainEntry {
  entryId: string;
  title: string;
  content: string;
  visibility: BrainVisibility;
  sourceType: string;
  objectRef?: string | null;
  trustLevel?: string | null;
}

export interface AiContextDebugItem {
  kind: "world" | "campaign" | "session" | "page" | "brain";
  id: string;
  title: string;
  visibility?: string;
  charCount: number;
  included: boolean;
  reason?: string;
}

export interface AiContextDebug {
  audience: ContextAudience;
  allowDmOnly: boolean;
  maxChars: number;
  totalChars: number;
  truncated: boolean;
  items: AiContextDebugItem[];
  collectedAt: string;
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
  world?: AiContextWorld;
  campaign?: AiContextCampaign;
  brainEntries?: AiContextBrainEntry[];
  pages: AiContextPage[];
  sources: AiContextSource[];
  promptContext: string;
  truncated: boolean;
  datenschutzMode: boolean;
  allowDmOnly: boolean;
  debug?: AiContextDebug;
}

export interface BuildAiContextOptions {
  allowDmOnly?: boolean;
  maxChars?: number;
  includeRelatedPageIds?: string[];
  datenschutzMode?: boolean;
  localOnly?: boolean;
  sessionId?: string;
  audience?: ContextAudience;
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
