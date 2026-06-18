/** Supported local inference engines in UWE Cookbook. */
export type CookbookEngineId =
  | "ollama"
  | "openai_compatible"
  | "rtx_agent"
  | "docker_ollama"
  | "lm_studio";

export type GpuBackend = "cuda" | "rocm" | "metal" | "cpu" | "unknown";

export type CookbookUseCaseId =
  | "dnd_generator"
  | "deep_research"
  | "editor_rewrite"
  | "image_prompting"
  | "session_prep"
  | "canon_check"
  | "player_safe_rewrite";

export type ModelFitLevel = "excellent" | "good" | "marginal" | "poor" | "unsupported";

export type QuantFormat = "Q2_K" | "Q3_K_M" | "Q4_K_M" | "Q5_K_M" | "Q6_K" | "Q8_0" | "FP16";

export interface CookbookGpuInfo {
  index: number;
  name: string;
  vramGb: number;
}

export interface CookbookGpuGroup {
  name: string;
  vramEachGb: number;
  count: number;
  indices: number[];
  vramTotalGb: number;
}

export interface CookbookHardwareProfile {
  platform: NodeJS.Platform;
  arch: string;
  cpuCores: number;
  ramGb: number;
  backend: GpuBackend;
  gpuName: string | null;
  gpuVramGb: number;
  gpuCount: number;
  gpus: CookbookGpuInfo[];
  gpuGroups: CookbookGpuGroup[];
  unifiedMemory: boolean;
  homogeneousGpus: boolean;
  probeSource: "nvidia-smi" | "env" | "fallback";
  probeMessage: string;
  probedAt: string;
}

export interface CookbookModelEntry {
  id: string;
  label: string;
  family: string;
  paramsB: number;
  contextLength: number;
  isMoe: boolean;
  isMultimodal: boolean;
  tags: string[];
  ollamaTags: string[];
  minVramGbQ4: number;
  recommendedQuant: QuantFormat;
  engines: CookbookEngineId[];
  useCases: CookbookUseCaseId[];
}

export interface CookbookEngineDefinition {
  id: CookbookEngineId;
  label: string;
  description: string;
  isLocal: boolean;
  defaultPort: number | null;
  setupHints: string[];
  healthPath: string | null;
}

export interface ModelFitResult {
  modelId: string;
  score: number;
  level: ModelFitLevel;
  estimatedVramGb: number;
  estimatedRamGb: number;
  contextSupported: number;
  fitsGpu: boolean;
  fitsRam: boolean;
  notes: string[];
}

export interface CookbookRecommendation {
  useCase: CookbookUseCaseId;
  label: string;
  description: string;
  modelId: string;
  modelLabel: string;
  engineId: CookbookEngineId;
  fit: ModelFitResult;
  privacyNote: string;
}

export interface RuntimeEngineStatus {
  engineId: CookbookEngineId;
  label: string;
  online: boolean;
  endpoint: string | null;
  modelCount: number | null;
  defaultModel: string | null;
  message: string;
  urlAllowed: boolean;
}

export interface DockerDiagnostic {
  available: boolean;
  running: boolean;
  message: string;
  ollamaContainerDetected: boolean;
}

export interface OllamaDiagnostic {
  reachable: boolean;
  endpoint: string;
  modelCount: number;
  models: string[];
  message: string;
  urlAllowed: boolean;
}

export interface ServeDiagnosis {
  pattern: string;
  summary: string;
  suggestions: string[];
}

export interface CookbookRuntimeHealth {
  ok: boolean;
  localOnlyMode: boolean;
  engines: RuntimeEngineStatus[];
  ollama: OllamaDiagnostic;
  docker: DockerDiagnostic;
  diagnoses: ServeDiagnosis[];
  warnings: string[];
  nextSteps: string[];
}

export interface CookbookDashboard {
  hardware: CookbookHardwareProfile;
  installedModels: string[];
  registry: CookbookModelEntry[];
  engines: CookbookEngineDefinition[];
  recommendations: CookbookRecommendation[];
  runtime: CookbookRuntimeHealth;
  routingHints: CookbookRoutingHints;
}

export interface CookbookRoutingHints {
  preferLocal: boolean;
  cloudBlocked: boolean;
  cloudBlockReason: string | null;
  recommendedModel: string | null;
  recommendedEngine: CookbookEngineId | null;
  warnings: string[];
}
