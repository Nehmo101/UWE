import { listCookbookEngines } from "./engine-registry";
import {
  listCookbookModels,
  matchInstalledModel,
  USE_CASE_LABELS,
} from "./model-registry";
import type { CookbookModelEntry } from "./types";
import { rankModelsForHardware } from "./model-fit";
import type {
  CookbookHardwareProfile,
  CookbookRecommendation,
  CookbookUseCaseId,
} from "./types";

const USE_CASE_ORDER: CookbookUseCaseId[] = [
  "dnd_generator",
  "deep_research",
  "editor_rewrite",
  "image_prompting",
  "session_prep",
  "canon_check",
  "player_safe_rewrite",
];

function pickEngine(model: CookbookModelEntry): CookbookRecommendation["engineId"] {
  // The legacy inbound RTX Agent (`RTX_AGENT_URL`) is no longer a recommended
  // engine — local inference runs via Ollama / OpenAI-compatible servers and the
  // outbound RTX Host Connector queue.
  if (process.env.AI_INFERENCE_PROVIDER === "openai_compatible") {
    return "openai_compatible";
  }
  return model.engines[0] ?? "ollama";
}

export function buildCookbookRecommendations(
  hardware: CookbookHardwareProfile,
  installedModels: string[] = [],
): CookbookRecommendation[] {
  const registry = listCookbookModels();
  const recommendations: CookbookRecommendation[] = [];

  for (const useCase of USE_CASE_ORDER) {
    const meta = USE_CASE_LABELS[useCase];
    const candidates = registry.filter((m) => m.useCases.includes(useCase));

    const installedCandidate = candidates.find((model) =>
      installedModels.some((id) => matchInstalledModel(id, model)),
    );

    const ranked = rankModelsForHardware(hardware, {
      useCase,
      models: installedCandidate ? [installedCandidate] : candidates,
      limit: 1,
    });

    const top = ranked[0];
    const model = top
      ? (candidates.find((m) => m.id === top.modelId) ?? candidates[0])
      : candidates[0];

    if (!model) continue;

    const fit = top ?? rankModelsForHardware(hardware, { useCase, models: [model], limit: 1 })[0];
    if (!fit) continue;

    const engineId = pickEngine(model);

    const privacyNote =
      useCase === "player_safe_rewrite" || useCase === "canon_check" || useCase === "session_prep"
        ? "Nur lokale Inferenz — Brain-/Kampagnenkontext darf nicht in die Cloud."
        : useCase === "deep_research"
          ? "Persönliches Brain und Kampagnendaten: strikt local-only."
          : "Bei privatem Kontext Cloud-Provider blockiert.";

    recommendations.push({
      useCase,
      label: meta.label,
      description: meta.description,
      modelId: model.id,
      modelLabel: model.label,
      engineId,
      fit,
      privacyNote,
    });
  }

  return recommendations;
}

export function getRecommendationForUseCase(
  hardware: CookbookHardwareProfile,
  useCase: CookbookUseCaseId,
  installedModels: string[] = [],
): CookbookRecommendation | null {
  return buildCookbookRecommendations(hardware, installedModels).find((r) => r.useCase === useCase) ?? null;
}

export function listCookbookSetupHints(): Array<{ engineId: string; label: string; hints: string[] }> {
  return listCookbookEngines().map((engine) => ({
    engineId: engine.id,
    label: engine.label,
    hints: engine.setupHints,
  }));
}
