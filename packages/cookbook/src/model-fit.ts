import { estimateModelRamGb, estimateModelVramGb, getCookbookModel } from "./model-registry";
import type {
  CookbookHardwareProfile,
  CookbookModelEntry,
  CookbookUseCaseId,
  ModelFitLevel,
  ModelFitResult,
  QuantFormat,
} from "./types";

const USE_CASE_CONTEXT: Record<CookbookUseCaseId, number> = {
  dnd_generator: 8192,
  deep_research: 16384,
  editor_rewrite: 8192,
  image_prompting: 4096,
  session_prep: 8192,
  canon_check: 12288,
  player_safe_rewrite: 4096,
  theme_design: 8192,
};

const USE_CASE_MIN_SCORE: Record<CookbookUseCaseId, number> = {
  dnd_generator: 55,
  deep_research: 65,
  editor_rewrite: 50,
  image_prompting: 45,
  session_prep: 55,
  canon_check: 60,
  player_safe_rewrite: 50,
  // Reliable structured JSON needs a capable model — on par with generation.
  theme_design: 55,
};

function scoreToLevel(score: number): ModelFitLevel {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "marginal";
  if (score >= 25) return "poor";
  return "unsupported";
}

export function computeModelFit(
  hardware: CookbookHardwareProfile,
  model: CookbookModelEntry,
  options?: {
    useCase?: CookbookUseCaseId;
    quant?: QuantFormat;
    contextLength?: number;
  },
): ModelFitResult {
  const useCase = options?.useCase;
  const quant = options?.quant ?? model.recommendedQuant;
  const requestedContext = options?.contextLength ?? (useCase ? USE_CASE_CONTEXT[useCase] : 4096);
  const contextLength = Math.min(requestedContext, model.contextLength);

  const estimatedVramGb = estimateModelVramGb(model, quant, contextLength);
  const estimatedRamGb = estimateModelRamGb(model, quant);

  const availableVram = hardware.gpuVramGb > 0 ? hardware.gpuVramGb : hardware.ramGb * 0.6;
  const vramRatio = availableVram / Math.max(estimatedVramGb, 0.1);
  const ramRatio = hardware.ramGb / Math.max(estimatedRamGb, 0.1);

  const fitsGpu = vramRatio >= 1;
  const fitsRam = ramRatio >= 1;

  let score = 0;
  const notes: string[] = [];

  if (fitsGpu) {
    score += 50;
    if (vramRatio >= 1.5) {
      score += 15;
      notes.push("Komfortabler VRAM-Headroom für längere Kontexte.");
    }
  } else if (vramRatio >= 0.85) {
    score += 30;
    notes.push("Knapp am VRAM-Limit — kleinere Quantisierung oder kürzerer Kontext empfohlen.");
  } else {
    score += Math.round(vramRatio * 25);
    notes.push("Modell überschreitet verfügbaren VRAM — CPU-Offload oder kleineres Modell.");
  }

  if (fitsRam) {
    score += 20;
  } else {
    score += Math.round(ramRatio * 10);
    notes.push("RAM könnte für CPU-Offload knapp werden.");
  }

  // Capability/utilization bonus: on hardware with real VRAM headroom, a larger
  // model that still fits is a better use of the GPU than a tiny one. Credited
  // only when the model fits the GPU, so a small-VRAM machine still prefers the
  // small models that actually fit, while a big rig (e.g. an added 24GB card)
  // leans into the more capable ones instead of always defaulting to 3B/7B.
  if (fitsGpu) {
    const capability = Math.min(model.paramsB, 32) / 32; // 0..1 over the useful range
    const capabilityBonus = Math.round(capability * 25);
    score += capabilityBonus;
    if (capabilityBonus >= 8) {
      notes.push("Nutzt das verfügbare VRAM-Budget für ein leistungsfähigeres Modell.");
    }
  }

  // Reward models that can actually serve the requested context window. (A model
  // with a large max context must not be penalised just because a given use case
  // asks for less — the previous "used ≥ half the max" check did exactly that,
  // pushing high-context models like Qwen 14B below smaller ones.)
  if (model.contextLength >= requestedContext) {
    score += 10;
  }

  if (hardware.backend === "cpu" && model.paramsB > 14) {
    score -= 15;
    notes.push("Großes Modell auf CPU — langsame Inferenz erwartet.");
  }

  if (useCase === "deep_research" && model.paramsB < 7) {
    score -= 5;
    notes.push("Für Deep Research sind ≥7B Parameter empfohlen.");
  }

  if (useCase === "player_safe_rewrite" && model.tags.includes("reasoning")) {
    score += 5;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    modelId: model.id,
    score,
    level: scoreToLevel(score),
    estimatedVramGb,
    estimatedRamGb,
    contextSupported: contextLength,
    fitsGpu,
    fitsRam,
    notes,
  };
}

export function rankModelsForHardware(
  hardware: CookbookHardwareProfile,
  options?: {
    useCase?: CookbookUseCaseId;
    models?: CookbookModelEntry[];
    minScore?: number;
    limit?: number;
  },
): ModelFitResult[] {
  const models = options?.models ?? [];
  const minScore = options?.minScore ?? (options?.useCase ? USE_CASE_MIN_SCORE[options.useCase] : 40);

  return models
    .map((model) => ({
      model,
      fit: computeModelFit(hardware, model, { useCase: options?.useCase }),
    }))
    .filter(({ fit }) => fit.score >= minScore)
    // Highest fit first; on a score tie prefer the larger (more capable) model
    // so a machine with VRAM headroom leans into stronger models.
    .sort((a, b) => b.fit.score - a.fit.score || b.model.paramsB - a.model.paramsB)
    .slice(0, options?.limit ?? 20)
    .map(({ fit }) => fit);
}

export function resolveModelFitById(
  hardware: CookbookHardwareProfile,
  modelId: string,
  useCase?: CookbookUseCaseId,
): ModelFitResult | null {
  const model = getCookbookModel(modelId);
  if (!model) return null;
  return computeModelFit(hardware, model, { useCase });
}

export { USE_CASE_CONTEXT, USE_CASE_MIN_SCORE };
