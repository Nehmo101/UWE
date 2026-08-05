/**
 * Mirrors the AI router modes and the task taxonomy without taking a
 * dependency. `@uwe/cookbook` has an empty `dependencies` block on purpose —
 * it is the hardware/model advisor and must stay loadable without the security
 * layer (zod, ioredis, @uwe/auth) hanging off it. That is why these are hand
 * copies and not `export type { AiTaskType } from "@uwe/security/inference"`.
 *
 * The price of that decision is drift, and it was paid once: when the four
 * Atlas tasks were added, nothing here failed to compile, and the copy simply
 * disagreed with the source. `packages/ai-brain/src/ai-task-taxonomy.test.ts`
 * now reads BOTH files as text and fails when the sets differ — the compiler
 * cannot see this file, so a test has to.
 */
export type CookbookAiProviderMode = "auto" | "local_engine" | "cloud";

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
  | "draft_campaign_chapter"
  | "suggest_session_hooks"
  | "create_player_handout"
  | "fill_dungeon_room"
  | "prepare_mail_draft"
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

export interface CookbookEngineHostProbe {
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
  engineHost: CookbookEngineHostProbe;
  skipDocker?: boolean;
}
