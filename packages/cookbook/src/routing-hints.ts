import type {
  CookbookAiContextMode,
  CookbookAiProviderMode,
  CookbookAiTaskType,
} from "./ai-types";
import { COOKBOOK_LOCAL_ONLY_CONTEXT_MODES } from "./ai-types";
import type { CookbookRoutingHints, CookbookUseCaseId } from "./types";
import { getRecommendationForUseCase } from "./recommendations";
import type { CookbookHardwareProfile } from "./types";

const TASK_TO_USE_CASE: Partial<Record<CookbookAiTaskType, CookbookUseCaseId>> = {
  create_npc: "dnd_generator",
  create_location: "dnd_generator",
  create_encounter: "dnd_generator",
  fill_dungeon_room: "dnd_generator",
  improve_lore_text: "editor_rewrite",
  summarize_page: "editor_rewrite",
  prepare_canon_check: "canon_check",
  detect_contradictions: "canon_check",
  prepare_next_session: "session_prep",
  summarize_session: "session_prep",
  generate_player_recap: "player_safe_rewrite",
  create_player_handout: "player_safe_rewrite",
  suggest_links: "deep_research",
  suggest_backlinks: "deep_research",
  find_open_threads: "deep_research",
  prepare_mail_draft: "player_safe_rewrite",
};

export function mapTaskToUseCase(taskType: CookbookAiTaskType): CookbookUseCaseId {
  return TASK_TO_USE_CASE[taskType] ?? "editor_rewrite";
}

export function isPrivateContextMode(contextMode: CookbookAiContextMode): boolean {
  return (COOKBOOK_LOCAL_ONLY_CONTEXT_MODES as readonly string[]).includes(contextMode);
}

export function buildCookbookRoutingHints(input: {
  providerMode: CookbookAiProviderMode;
  contextMode: CookbookAiContextMode;
  taskType: CookbookAiTaskType;
  localOnlyMode: boolean;
  rtxReady: boolean;
  hardware: CookbookHardwareProfile;
  installedModels?: string[];
  explicitModel?: string;
}): CookbookRoutingHints {
  const warnings: string[] = [];
  const privateContext = isPrivateContextMode(input.contextMode);

  const cloudBlocked = privateContext || input.localOnlyMode;
  let cloudBlockReason: string | null = null;

  if (privateContext) {
    cloudBlockReason =
      "Lokaler Kampagnen-/Brain-Kontext darf nicht an Cloud-Provider gesendet werden.";
    warnings.push(cloudBlockReason);
  } else if (input.localOnlyMode) {
    cloudBlockReason = "Local-only-Modus aktiv — Cloud-KI ist deaktiviert.";
    warnings.push(cloudBlockReason);
  }

  if (input.providerMode === "cloud" && cloudBlocked) {
    warnings.push("Gewählter Cloud-Modus wird für diesen Kontext blockiert.");
  }

  if (input.providerMode === "local_rtx" && !input.rtxReady) {
    warnings.push("Lokale RTX-Inference ist nicht bereit — Aufgabe wird nicht an Cloud weitergeleitet.");
  }

  const preferLocal = privateContext || input.localOnlyMode || input.providerMode !== "cloud";

  let recommendedModel: string | null = input.explicitModel?.trim() || null;
  let recommendedEngine = null as CookbookRoutingHints["recommendedEngine"];

  if (!recommendedModel) {
    const useCase = mapTaskToUseCase(input.taskType);
    const rec = getRecommendationForUseCase(
      input.hardware,
      useCase,
      input.installedModels,
    );
    if (rec) {
      recommendedModel = rec.modelId;
      recommendedEngine = rec.engineId;
    }
  }

  return {
    preferLocal,
    cloudBlocked,
    cloudBlockReason,
    recommendedModel,
    recommendedEngine,
    warnings,
  };
}

export function resolveCookbookModelForRequest(input: {
  explicitModel?: string;
  taskType: CookbookAiTaskType;
  rtxDefaultModel: string;
  hardware: CookbookHardwareProfile;
  installedModels?: string[];
}): string {
  if (input.explicitModel?.trim()) {
    return input.explicitModel.trim();
  }

  const useCase = mapTaskToUseCase(input.taskType);
  const rec = getRecommendationForUseCase(
    input.hardware,
    useCase,
    input.installedModels,
  );

  if (rec) {
    const installed = input.installedModels?.find(
      (id) => rec.modelId === id || id.startsWith(`${rec.modelId}:`),
    );
    if (installed) return installed;
    return rec.modelId;
  }

  return input.rtxDefaultModel;
}
