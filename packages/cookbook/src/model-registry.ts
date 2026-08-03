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
  document_ocr: {
    label: "Dokumenten-OCR",
    description: "PDFs und Scans layout-treu lesen — Grundlage für den Kampagnen-Import.",
  },
  theme_design: {
    label: "Design-Assistent",
    description: "Farbpaletten/Themes im Fragebogen-Chat als striktes JSON erzeugen.",
  },
};

/**
 * Models suited to the conversational design creator: strong instruction-
 * following + reliable structured JSON + solid German. Deliberately excludes
 * tiny (<7B) and reasoning/RAG-tuned models that produce unreliable JSON.
 */
const THEME_DESIGN_MODEL_IDS = new Set<string>([
  "qwen2.5:7b",
  "qwen2.5:14b",
  "qwen2.5:32b",
  "qwen2.5:72b",
  "qwen2.5-coder:32b",
  "llama3.1:8b",
  "mistral-small:24b",
  "gemma2:27b",
  "llama3.3:70b",
  "mixtral:8x7b",
]);

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
    engines: ["ollama", "engine_agent", "docker_ollama"],
    useCases: ["editor_rewrite", "image_prompting", "player_safe_rewrite"],
    summary: "Sehr schnell und ressourcenschonend — ideal für kurze Umschreibungen auf schwacher Hardware.",
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
    engines: ["ollama", "openai_compatible", "engine_agent", "docker_ollama", "lm_studio"],
    useCases: ["dnd_generator", "session_prep", "editor_rewrite", "canon_check", "player_safe_rewrite"],
    summary: "Solider Allrounder für Generierung und Vorbereitung — läuft schon auf 8-GB-GPUs flüssig.",
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
    engines: ["ollama", "openai_compatible", "engine_agent", "docker_ollama", "lm_studio"],
    useCases: ["dnd_generator", "editor_rewrite", "session_prep", "canon_check"],
    summary: "Starkes Deutsch bei geringem VRAM-Bedarf — guter Kompromiss aus Tempo und Qualität.",
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
    engines: ["ollama", "openai_compatible", "engine_agent", "docker_ollama", "lm_studio"],
    useCases: ["deep_research", "canon_check", "session_prep", "dnd_generator"],
    summary: "Deutlich mehr Qualität und langer Kontext — braucht ~10 GB VRAM, ideal ab Mittelklasse-GPU.",
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
    engines: ["ollama", "engine_agent", "docker_ollama"],
    useCases: ["editor_rewrite", "dnd_generator", "player_safe_rewrite"],
    summary: "Kompaktes, schnelles Modell für kreatives Schreiben und Umformulieren.",
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
    engines: ["ollama", "engine_agent", "docker_ollama"],
    useCases: ["editor_rewrite", "session_prep", "player_safe_rewrite"],
    summary: "Ausgewogene Textqualität bei moderatem VRAM — stark im Umschreiben und Aufbereiten.",
  },
  {
    id: "gemma2:27b",
    label: "Gemma 2 27B",
    family: "gemma",
    paramsB: 27,
    contextLength: 8192,
    isMoe: false,
    isMultimodal: false,
    tags: ["quality", "german"],
    ollamaTags: ["gemma2:27b"],
    minVramGbQ4: 17,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "engine_agent", "docker_ollama", "lm_studio"],
    useCases: ["editor_rewrite", "session_prep", "player_safe_rewrite", "canon_check"],
    summary: "Sehr hohe Textqualität — nutzt ~17 GB VRAM und lohnt sich ab starken 24-GB-GPUs.",
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
    engines: ["ollama", "openai_compatible", "engine_agent", "docker_ollama"],
    useCases: ["deep_research", "canon_check"],
    summary: "Schlankes Reasoning-Modell für Analyse und Konsistenzprüfungen auf kleiner GPU.",
  },
  {
    id: "deepseek-r1:32b",
    label: "DeepSeek R1 32B",
    family: "deepseek",
    paramsB: 32,
    contextLength: 131072,
    isMoe: false,
    isMultimodal: false,
    tags: ["reasoning", "quality"],
    ollamaTags: ["deepseek-r1:32b"],
    minVramGbQ4: 20,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "engine_agent", "docker_ollama", "lm_studio"],
    useCases: ["deep_research", "canon_check"],
    summary: "Tiefes Reasoning für komplexe Lore-Analyse und Widerspruchssuche — ~20 GB VRAM.",
  },
  {
    id: "qwq:32b",
    label: "QwQ 32B",
    family: "qwen",
    paramsB: 32,
    contextLength: 32768,
    isMoe: false,
    isMultimodal: false,
    tags: ["reasoning", "quality"],
    ollamaTags: ["qwq", "qwq:32b"],
    minVramGbQ4: 20,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "engine_agent", "docker_ollama", "lm_studio"],
    useCases: ["deep_research", "canon_check", "session_prep"],
    summary: "Reasoning-Spezialist auf Augenhöhe mit großen Modellen — stark bei kniffligen Fragen.",
  },
  {
    id: "qwen2.5:32b",
    label: "Qwen 2.5 32B",
    family: "qwen",
    paramsB: 32,
    contextLength: 131072,
    isMoe: false,
    isMultimodal: false,
    tags: ["quality", "german"],
    ollamaTags: ["qwen2.5:32b"],
    minVramGbQ4: 20,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "engine_agent", "docker_ollama", "lm_studio"],
    useCases: ["deep_research", "canon_check", "session_prep", "dnd_generator"],
    summary: "Top-Deutsch und langer Kontext in der 32B-Klasse — nutzt ~20 GB VRAM voll aus.",
  },
  {
    id: "qwen2.5-coder:32b",
    label: "Qwen 2.5 Coder 32B",
    family: "qwen",
    paramsB: 32,
    contextLength: 131072,
    isMoe: false,
    isMultimodal: false,
    tags: ["quality", "code"],
    ollamaTags: ["qwen2.5-coder:32b", "qwen2.5-coder"],
    minVramGbQ4: 20,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "engine_agent", "docker_ollama", "lm_studio"],
    useCases: ["deep_research", "editor_rewrite"],
    summary: "Code- und strukturstark — gut für Tools, Skripte und präzise Texttransformationen.",
  },
  {
    id: "mistral-small:24b",
    label: "Mistral Small 24B",
    family: "mistral",
    paramsB: 24,
    contextLength: 32768,
    isMoe: false,
    isMultimodal: false,
    tags: ["quality", "balanced"],
    ollamaTags: ["mistral-small", "mistral-small:24b"],
    minVramGbQ4: 14,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "engine_agent", "docker_ollama", "lm_studio"],
    useCases: ["dnd_generator", "editor_rewrite", "session_prep", "canon_check"],
    summary: "Kräftiger Allrounder der 24B-Klasse — starke Qualität bei nur ~14 GB VRAM.",
  },
  {
    id: "mixtral:8x7b",
    label: "Mixtral 8x7B (MoE)",
    family: "mixtral",
    paramsB: 47,
    contextLength: 32768,
    isMoe: true,
    isMultimodal: false,
    tags: ["quality", "moe"],
    ollamaTags: ["mixtral", "mixtral:8x7b"],
    minVramGbQ4: 26,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "engine_agent", "docker_ollama", "lm_studio"],
    useCases: ["dnd_generator", "deep_research", "editor_rewrite", "canon_check"],
    summary: "Mixture-of-Experts: Wissen eines Großmodells bei der Geschwindigkeit eines 13B — ~26 GB VRAM.",
  },
  {
    id: "command-r:35b",
    label: "Command R 35B",
    family: "command-r",
    paramsB: 35,
    contextLength: 131072,
    isMoe: false,
    isMultimodal: false,
    tags: ["quality", "rag", "long-context"],
    ollamaTags: ["command-r", "command-r:35b"],
    minVramGbQ4: 21,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "engine_agent", "docker_ollama", "lm_studio"],
    useCases: ["deep_research", "canon_check"],
    summary: "Für Retrieval und sehr lange Kontexte gebaut — ideal für Brain-gestützte Recherche (~21 GB).",
  },
  {
    id: "llama3.3:70b",
    label: "Llama 3.3 70B",
    family: "llama",
    paramsB: 70,
    contextLength: 131072,
    isMoe: false,
    isMultimodal: false,
    tags: ["quality", "large"],
    ollamaTags: ["llama3.3", "llama3.3:70b"],
    minVramGbQ4: 42,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "engine_agent", "lm_studio"],
    useCases: ["deep_research", "canon_check", "dnd_generator"],
    summary: "Spitzenqualität der 70B-Klasse — braucht ~42 GB VRAM (Multi-GPU) oder CPU-Offload.",
  },
  {
    id: "qwen2.5:72b",
    label: "Qwen 2.5 72B",
    family: "qwen",
    paramsB: 72,
    contextLength: 131072,
    isMoe: false,
    isMultimodal: false,
    tags: ["quality", "large", "german"],
    ollamaTags: ["qwen2.5:72b"],
    minVramGbQ4: 44,
    recommendedQuant: "Q4_K_M",
    engines: ["ollama", "openai_compatible", "engine_agent", "lm_studio"],
    useCases: ["deep_research", "canon_check", "session_prep"],
    summary: "Bestes Deutsch im Katalog — ~44 GB VRAM, erst mit sehr viel VRAM oder Offload nutzbar.",
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
    engines: ["ollama", "openai_compatible", "engine_agent"],
    useCases: ["deep_research", "canon_check"],
    summary: "Großes, hochwertiges Modell — ~42 GB VRAM, für Multi-GPU-Setups oder CPU-Offload.",
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
    engines: ["ollama", "engine_agent", "docker_ollama"],
    useCases: ["deep_research"],
    summary: "Kein Chat-Modell, sondern für Embeddings/Retrieval — winziger VRAM-Bedarf.",
  },
  {
    id: "unlimited-ocr",
    label: "Unlimited-OCR",
    family: "unlimited-ocr",
    // 3,3 Mrd. Parameter MoE, davon ~0,5 Mrd. aktiv — daher der kleine
    // VRAM-Bedarf trotz der Gesamtgröße.
    paramsB: 3.3,
    contextLength: 32768,
    isMoe: true,
    isMultimodal: true,
    tags: ["vision", "multimodal", "ocr", "document"],
    ollamaTags: ["frob/unlimited-ocr:q8_0", "frob/unlimited-ocr:f16", "frob/unlimited-ocr"],
    minVramGbQ4: 5,
    recommendedQuant: "Q8_0",
    engines: ["ollama", "engine_agent", "docker_ollama"],
    useCases: ["document_ocr"],
    summary:
      "Liest PDF-Seiten layout-treu als Markdown — mehrspaltig, mit Tabellen und Bildboxen. Basis für PDF→Kampagne und die Scan-Inbox.",
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
    engines: ["ollama", "engine_agent", "docker_ollama"],
    useCases: ["image_prompting"],
    summary: "Multimodal (Bild + Text) — versteht Bilder und hilft bei Bild-Prompts.",
  },
];

// Tag the design-suited models with the `theme_design` use case in one place,
// keeping the curated selection above the per-model entries.
for (const model of COOKBOOK_MODEL_REGISTRY) {
  if (THEME_DESIGN_MODEL_IDS.has(model.id) && !model.useCases.includes("theme_design")) {
    model.useCases = [...model.useCases, "theme_design"];
  }
}

export interface ModelStrength {
  /** 1 (leicht) … 5 (Spitzenklasse). */
  tier: number;
  label: string;
}

/**
 * Coarse capability tier derived from parameter count — a quick "how strong is
 * this model" signal for the catalog, independent of whether it fits the given
 * hardware (that's what the fit score is for).
 */
export function modelStrengthTier(paramsB: number): ModelStrength {
  if (paramsB >= 40) return { tier: 5, label: "Spitzenklasse" };
  if (paramsB >= 20) return { tier: 4, label: "Sehr stark" };
  if (paramsB >= 11) return { tier: 3, label: "Stark" };
  if (paramsB >= 5) return { tier: 2, label: "Solide" };
  return { tier: 1, label: "Leicht" };
}

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
