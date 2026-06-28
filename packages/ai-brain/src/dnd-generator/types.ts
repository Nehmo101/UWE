import type { AiTaskType } from "../types";

/** DnD context kinds the generator understands. */
export type DndContextKind =
  | "world"
  | "page"
  | "npc"
  | "location"
  | "faction"
  | "quest"
  | "session"
  | "dungeon"
  | "dungeon_level"
  | "room"
  | "encounter"
  | "puzzle"
  | "trap"
  | "loot"
  | "handout"
  | "monster"
  | "rule"
  | "workshop_project";

export type DndGeneratorActionId =
  | "summarize"
  | "player_version"
  | "dm_notes"
  | "extract_brain_facts"
  | "create_knowledge_text"
  | "canon_check"
  | "prepare_next_session"
  | "fill_missing"
  | "create_handout"
  | "create_label"
  | "image_prompt"
  | "regenerate_tone"
  | "continue_variant";

export interface DndGeneratorAction {
  id: DndGeneratorActionId;
  label: string;
  description: string;
  taskType?: AiTaskType;
  brainActionId?: string;
  playerSafe: boolean;
  requiresSession?: boolean;
  requiresReview: true;
}

export interface DndContextDescriptor {
  kind: DndContextKind;
  worldSlug: string;
  worldId?: string;
  pageSlug?: string;
  pageId?: string;
  pageType?: string;
  title?: string;
  sessionId?: string;
  dungeonSlug?: string;
  levelSlug?: string;
  roomSlug?: string;
  workshopProjectId?: string;
}

export interface MissingContentHint {
  field: string;
  label: string;
  severity: "info" | "warn";
  suggestedActionId: DndGeneratorActionId;
}

export interface CanonConflictHint {
  code: string;
  message: string;
  severity: "warn" | "error";
  suggestion?: string;
}

export interface GeneratorPreset {
  id: string;
  label: string;
  contextKind: DndContextKind;
  description: string;
  templateHint: string;
}

export interface PrepareNextSessionOutline {
  summary: string;
  openPlots: string[];
  relevantNpcs: string[];
  relevantLocations: string[];
  likelyScenes: string[];
  encounterSuggestions: string[];
  handoutIdeas: string[];
  soundboardSuggestions: string[];
  labelPrintList: string[];
  playerKnowledge: string[];
  dmOnlyDangers: string[];
  canonWarnings: string[];
}

export interface GeneratorHistoryEntry {
  runId: string;
  actionId: DndGeneratorActionId;
  createdAt: string;
  label: string;
  isFavorite: boolean;
}

export interface DndGeneratorView {
  context: DndContextDescriptor;
  actions: DndGeneratorAction[];
  missingContent: MissingContentHint[];
  canonConflicts: CanonConflictHint[];
  presets: GeneratorPreset[];
  history: GeneratorHistoryEntry[];
}
