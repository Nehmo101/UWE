import type { CookbookModelEntry, CookbookUseCaseId, QuantFormat } from "./types";

/** Bytes per parameter by quantization (approximate). */
export const QUANT_BYTES_PER_PARAM: Record<QuantFormat, number> = {
  Q2_K: 0.28,
  Q3_K_M: 0.38,
  Q4_K_M: 0.58,
  Q5_K_M: 0.7,
  Q6_K: 0.8,
  Q8_0: 1.0,
  FP16: 2.0,
};

export const USE_CASE_LABELS: Record<CookbookUseCaseId, { label: string; description: string }> = {
  dnd_generator: {
    label: "DnD Generator",
    description: "NPCs, Orte, Encounters und Dungeon-Räume generieren.",
  },
  deep_research: {
    label: "Deep Research",
    description: "Lange Kontexte, Brain-Retrieval und Lore-Analyse.",
  },
  editor_rewrite: {
    label: "Editor Rewrite",
    description: "Wiki-Texte verbessern und erweitern.",
  },
  image_prompting: {
    label: "Image Prompting",
    description: "Bild-Prompts für Image Studio formulieren.",
  },
  session_prep: {
    label: "Session Prep",
    description: "Agenda und Vorbereitung für die nächste Session.",
  },
  canon_check: {
    label: "Canon Check",
    description: "Kanon-Konflikte und Widersprüche erkennen.",
  },
  player_safe_rewrite: {
    label: "Player-safe Rewrite",
    description: "Spieler-Handouts und Recaps ohne DM-Leaks.",
  },
};

/**
 * Curated UWE model catalog — native registry, not copied from Odysseus (AGPL).
 * Sizes and VRAM estimates are approximate planning values.
 */
export const COOKBOOK_MODEL_REGISTRY: CookbookModelEntry[] = [
  {
    id: "llama3.2",
    label: "Llama 3.2 3B",
    family: "llama",
    paramsB: 3,
    contextLength: 131072,
    isMoe: false,
    isMultimodal: false,
    tags: ["fast", "general"],
    ollamaTags: ["llama3.2", "llama3.2:latest", "llama3.2:3b"],
    minVramGbQ4: 2.5,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "rtx_agent", "docker_ollama"],
    useCases: ["editor_rewrite", "image_prompting", "player_safe_rewrite"],
  },
  {
    id: "llama3.1:8b",
    label: "Llama 3.1 8B",
    family: "llama",
    paramsB: 8,
    contextLength: 131072,
    isMoe: false,
    isMultimodal: false,
    tags: ["balanced", "general"],
    ollamaTags: ["llama3.1:8b", "llama3.1"],
    minVramGbQ4: 5.5,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "rtx_agent", "docker_ollama", "lm_studio"],
    useCases: ["dnd_generator", "session_prep", "editor_rewrite", "canon_check", "player_safe_rewrite"],
  },
  {
    id: "qwen2.5:7b",
    label: "Qwen 2.5 7B",
    family: "qwen",
    paramsB: 7,
    contextLength: 131072,
    isMoe: false,
    isMultimodal: false,
    tags: ["balanced", "german"],
    ollamaTags: ["qwen2.5:7b", "qwen2.5"],
    minVramGbQ4: 5,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "rtx_agent", "docker_ollama", "lm_studio"],
    useCases: ["dnd_generator", "editor_rewrite", "session_prep", "canon_check"],
  },
  {
    id: "qwen2.5:14b",
    label: "Qwen 2.5 14B",
    family: "qwen",
    paramsB: 14,
    contextLength: 131072,
    isMoe: false,
    isMultimodal: false,
    tags: ["quality", "german"],
    ollamaTags: ["qwen2.5:14b"],
    minVramGbQ4: 10,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "rtx_agent", "docker_ollama", "lm_studio"],
    useCases: ["deep_research", "canon_check", "session_prep", "dnd_generator"],
  },
  {
    id: "mistral:7b",
    label: "Mistral 7B",
    family: "mistral",
    paramsB: 7,
    contextLength: 32768,
    isMoe: false,
    isMultimodal: false,
    tags: ["balanced"],
    ollamaTags: ["mistral:7b", "mistral"],
    minVramGbQ4: 5,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "rtx_agent", "docker_ollama"],
    useCases: ["editor_rewrite", "dnd_generator", "player_safe_rewrite"],
  },
  {
    id: "gemma2:9b",
    label: "Gemma 2 9B",
    family: "gemma",
    paramsB: 9,
    contextLength: 8192,
    isMoe: false,
    isMultimodal: false,
    tags: ["balanced"],
    ollamaTags: ["gemma2:9b", "gemma2"],
    minVramGbQ4: 6.5,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "rtx_agent", "docker_ollama"],
    useCases: ["editor_rewrite", "session_prep", "player_safe_rewrite"],
  },
  {
    id: "deepseek-r1:8b",
    label: "DeepSeek R1 8B",
    family: "deepseek",
    paramsB: 8,
    contextLength: 65536,
    isMoe: false,
    isMultimodal: false,
    tags: ["reasoning"],
    ollamaTags: ["deepseek-r1:8b", "deepseek-r1"],
    minVramGbQ4: 5.5,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "rtx_agent", "docker_ollama"],
    useCases: ["deep_research", "canon_check"],
  },
  {
    id: "llama3.1:70b",
    label: "Llama 3.1 70B",
    family: "llama",
    paramsB: 70,
    contextLength: 131072,
    isMoe: false,
    isMultimodal: false,
    tags: ["quality", "large"],
    ollamaTags: ["llama3.1:70b"],
    minVramGbQ4: 42,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "rtx_agent"],
    useCases: ["deep_research", "canon_check"],
  },
  {
    id: "nomic-embed-text",
    label: "Nomic Embed Text",
    family: "nomic",
    paramsB: 0.14,
    contextLength: 8192,
    isMoe: false,
    isMultimodal: false,
    tags: ["embedding"],
    ollamaTags: ["nomic-embed-text", "nomic-embed-text:latest"],
    minVramGbQ4: 0.5,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "rtx_agent", "docker_ollama"],
    useCases: ["deep_research"],
  },
  {
    id: "llava:7b",
    label: "LLaVA 7B",
    family: "llava",
    paramsB: 7,
    contextLength: 4096,
    isMoe: false,
    isMultimodal: true,
    tags: ["vision", "multimodal"],
    ollamaTags: ["llava:7b", "llava"],
    minVramGbQ4: 6,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "rtx_agent", "docker_ollama"],
    useCases: ["image_prompting"],
  },
];

export function getCookbookModel(id: string): CookbookModelEntry | undefined {
  const normalized = id.trim().toLowerCase();
  return COOKBOOK_MODEL_REGISTRY.find(
    (m) =>
      m.id.toLowerCase() === normalized ||
      m.ollamaTags.some((tag) => tag.toLowerCase() === normalized),
  );
}

export function listCookbookModels(): CookbookModelEntry[] {
  return [...COOKBOOK_MODEL_REGISTRY];
}

export function matchInstalledModel(
  installedId: string,
  registryEntry: CookbookModelEntry,
): boolean {
  const normalized = installedId.trim().toLowerCase();
  return (
    registryEntry.id.toLowerCase() === normalized ||
    registryEntry.ollamaTags.some((tag) => tag.toLowerCase() === normalized) ||
    normalized.startsWith(`${registryEntry.id.toLowerCase()}:`)
  );
}

export function estimateModelVramGb(
  model: CookbookModelEntry,
  quant: QuantFormat = model.recommendedQuant,
  contextLength = 4096,
): number {
  const weightGb = model.paramsB * QUANT_BYTES_PER_PARAM[quant];
  const activeParams = model.isMoe ? model.paramsB * 0.15 : model.paramsB;
  const kvGb = activeParams * contextLength * 0.000008;
  const headroom = model.isMultimodal ? 1.1 : 0.4;
  return Math.round((weightGb + kvGb + headroom) * 10) / 10;
}

export function estimateModelRamGb(model: CookbookModelEntry, quant: QuantFormat = model.recommendedQuant): number {
  const weightGb = model.paramsB * QUANT_BYTES_PER_PARAM[quant];
  return Math.round((weightGb * 1.2 + 2) * 10) / 10;
}
