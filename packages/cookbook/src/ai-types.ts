/** Mirrors @uwe/ai-brain router modes without creating a package cycle. */
export type CookbookAiProviderMode = "auto" | "local_rtx" | "cloud";

export type CookbookAiContextMode =
  | "general_chat"
  | "brain"
  | "current_object"
  | "current_object_plus_brain"
  | "personal_brain";

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
  | "prepare_canon_check"
  | "prepare_next_session"
  | "create_player_handout"
  | "fill_dungeon_room"
  | "prepare_mail_draft";

export const COOKBOOK_LOCAL_ONLY_CONTEXT_MODES: readonly CookbookAiContextMode[] = [
  "brain",
  "current_object",
  "current_object_plus_brain",
  "personal_brain",
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
