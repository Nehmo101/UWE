/**
 * AI context shape shared between `@uwe/security` (privacy sanitization guards
 * in `ai-policy`) and `@uwe/ai-brain` (the AI feature package). These types live
 * in the low-level `@uwe/security` layer so the security guards can classify and
 * sanitize context without importing the feature package. `@uwe/ai-brain/types`
 * re-exports every symbol here, so existing `@uwe/ai-brain` consumers are
 * unaffected and the type identity is preserved.
 */

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
  /* Terra map text tasks. They were called `atlas_name_region` (singular!) and
     `atlas_describe_region` until 28.07.2026 — Atlas is gone, the two tasks
     are not: naming and describing a map region works for any map. The two
     that WERE Atlas (`atlas_fill_area`, `atlas_generate_asset_proposal`) sat on
     the gouache asset registry and the AtlasObject payload and were dropped
     with it. The old plural/singular trap (`atlas_name_regions` as action id,
     `atlas_name_region` as task type) died with the rename: action id and task
     type are now the same string. */
  | "terra_name_regions"
  | "terra_describe_region"
  | "terra_world_draft"
  | "simulate_faction"
  | "generate_structured_npc"
  | "generate_structured_quest"
  | "generate_structured_item"
  | "answer_life_question"
  | "synthesize_research"
  | "summarize_mail"
  | "prioritize_mail"
  | "generate_briefing"
  | "answer_mail_question"
  | "generate_theme_palette";

/**
 * Label on a built AI context, for the debug view. It no longer filters
 * anything: per-item visibility is gone, so a context contains whatever the
 * world contains.
 */

export interface AiContextBlock {
  blockId: string;
  type: string;
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
  sourceType: string;
  objectRef?: string | null;
  trustLevel?: string | null;
}

export interface AiContextDebugItem {
  kind: "world" | "campaign" | "session" | "page" | "brain";
  id: string;
  title: string;
  charCount: number;
  included: boolean;
  reason?: string;
}

export interface AiContextDebug {
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
  debug?: AiContextDebug;
}
