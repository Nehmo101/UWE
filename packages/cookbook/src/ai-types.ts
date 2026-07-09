/** Mirrors @uwe/ai-brain router modes without creating a package cycle. */
export type CookbookAiProviderMode = "auto" | "local_rtx" | "cloud";

export type CookbookAiContextMode =
  | "general_chat"
  | "brain"
  | "current_object"
  | "current_object_plus_brain"
  | "personal_brain"
  | "mail";

export type CookbookAiTaskType =
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
  | "atlas_fill_area"
  | "atlas_generate_asset_proposal"
  | "simulate_faction"
  | "generate_structured_npc"
  | "generate_structured_quest"
  | "generate_structured_item"
  | "answer_life_question"
  | "synthesize_research"
  | "summarize_mail"
  | "prioritize_mail"
  | "answer_mail_question"
  | "generate_briefing"
  | "generate_theme_palette";

/**
 * Context modes that are permanently local-only in the cookbook routing layer.
 * personal_brain and mail are hard-blocked; DnD/world modes (brain,
 * current_object, current_object_plus_brain) may go to cloud when admin
 * gateway policy allows.
 */
export const COOKBOOK_LOCAL_ONLY_CONTEXT_MODES: readonly CookbookAiContextMode[] = [
  "personal_brain",
  "mail",
] as const;

export interface CookbookInferenceProbe {
  enabled: boolean;
  providerId: string;
  endpoint: string;
  defaultModel: string;
  online: boolean;
  message: string;
  urlAllowed: boolean;
  modelCount?: number;
}

export interface CookbookRtxProbe {
  ready: boolean;
  online: boolean;
  endpoint: string;
  defaultModel: string;
  message: string;
  urlAllowed: boolean;
  modelCount?: number;
  agentConfigured: boolean;
}

export interface CookbookRuntimeProbeInput {
  inference: CookbookInferenceProbe;
  rtx: CookbookRtxProbe;
  skipDocker?: boolean;
}
