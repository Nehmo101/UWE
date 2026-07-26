import type {
  ConnectorConnectionStatus,
  ConnectorProcessStatus,
} from "@uwe/connector-client-config";
import type { ConnectorModelProfileStore } from "@uwe/connector-model-profile";

export interface ConnectorRuntimeStatus extends ConnectorProcessStatus {
  connectionStatus: ConnectorConnectionStatus;
  lastHeartbeatAt?: string | null;
}

export interface HostConnectionTestResult {
  ok: boolean;
  status: ConnectorConnectionStatus;
  message: string;
  checkedAt: string;
}

export interface ConnectorJobHistoryEntry {
  id: string;
  type: string;
  lane: string;
  status: "completed" | "failed";
  durationMs: number;
  reason?: string;
  finishedAt: string;
}

export interface OllamaPullProgressEvent {
  type: "progress";
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  fraction?: number;
}

export interface OllamaPullDoneEvent {
  type: "done";
  name: string;
}

export type OllamaPullEvent = OllamaPullProgressEvent | OllamaPullDoneEvent;

export interface PullOllamaModelResult {
  events: OllamaPullEvent[];
  store: ConnectorModelProfileStore;
}

export type RunnerId = "ollama" | "lm_studio" | "llama_cpp";
export type RunnerStatus = "online" | "offline" | "error";

export interface RunnerProbeResult {
  id: RunnerId;
  label: string;
  endpoint: string;
  healthPath: string;
  status: RunnerStatus;
  modelCount: number | null;
  models: string[];
  message: string;
}

export interface OllamaSpeedResult {
  ok: boolean;
  model: string;
  tokensPerSecond: number | null;
  evalCount: number | null;
  message: string;
}

export interface RunnerTestResult extends RunnerProbeResult {
  speed?: OllamaSpeedResult;
}

export interface StartOllamaResult {
  ok: boolean;
  started: boolean;
  alreadyRunning: boolean;
  message: string;
  triedPaths: string[];
}

export interface CookbookGpuSummary {
  index: number;
  name: string;
  vramGb: number;
}

export interface CookbookHardwareSummary {
  platform: string;
  arch: string;
  cpuCores: number;
  ramGb: number;
  backend: string;
  gpuName: string | null;
  gpuVramGb: number;
  gpuCount: number;
  gpus: CookbookGpuSummary[];
  probeMessage: string;
}

export type CookbookFitLevel =
  | "excellent"
  | "good"
  | "marginal"
  | "poor"
  | "unsupported";

export interface CookbookModelFit {
  modelId: string;
  score: number;
  level: CookbookFitLevel;
  estimatedVramGb: number;
  estimatedRamGb: number;
  fitsGpu: boolean;
  fitsRam: boolean;
  notes: string[];
}

export interface CookbookRecommendationView {
  useCase: string;
  label: string;
  description: string;
  modelId: string;
  modelLabel: string;
  engineId: string;
  fit: CookbookModelFit;
  privacyNote: string;
}

export interface CookbookModelView {
  id: string;
  label: string;
  family: string;
  paramsB: number;
  contextLength: number;
  isMoe: boolean;
  isMultimodal: boolean;
  tags: string[];
  useCases: string[];
  engines: string[];
  recommendedQuant: string;
  minVramGbQ4: number;
  summary: string;
  strengthTier: number;
  strengthLabel: string;
  installed: boolean;
  fit: CookbookModelFit;
}

export interface CookbookDashboardView {
  hardware: CookbookHardwareSummary;
  installedModels: string[];
  recommendations: CookbookRecommendationView[];
  models: CookbookModelView[];
}

export interface SpotifyAuthUrlResult {
  url: string;
  state: string;
}

export interface SpotifyStatusResult {
  ok: boolean;
  message: string;
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  volumePercent: number | null;
}

export interface SpotifyDevicesResult {
  ok: boolean;
  connected: boolean;
  devices: SpotifyDevice[];
  deviceId: string | null;
  message?: string;
}

export interface CommandTestResult {
  ok: boolean;
  via?: string;
  message: string;
  output?: string;
}

/** One printer installed on the RTX host, plus the user's enable flag. */
export interface ConnectorPrinterProfile {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  state?: string;
  enabledForUwe: boolean;
}

export interface ConnectorPrinterStore {
  version: number;
  printers: ConnectorPrinterProfile[];
}

export interface LocalHostService {
  id: "studio" | "portal" | "brain" | "landing";
  label: string;
  state: "online" | "starting" | "stopped" | "error";
  healthy: boolean;
  pid: number | null;
  url: string;
  message: string;
}

export interface LocalHostStatus {
  collectedAt: string;
  overall: "ready" | "attention" | "error";
  root: string;
  revision: string | null;
  branch: string | null;
  installation: {
    repoReady: boolean;
    dependenciesReady: boolean;
    envReady: boolean;
    databaseReady: boolean;
    buildReady: boolean;
    message: string;
  };
  host: {
    hostname: string;
    platform: string;
    release: string;
    uptimeSeconds: number;
    cpuModel: string;
    cpuCores: number;
    ramTotalBytes: number;
    ramUsedBytes: number;
    diskTotalBytes: number | null;
    diskUsedBytes: number | null;
  };
  gpu: {
    available: boolean;
    name: string | null;
    vramTotalMb: number | null;
    utilizationPercent: number | null;
    temperatureC: number | null;
  };
  services: LocalHostService[];
  dataDir: string;
  logsDir: string;
}

export interface LocalHostActionResult {
  ok: boolean;
  message: string;
  status: LocalHostStatus;
}

export interface LocalHostUpdateInfo {
  ok: boolean;
  updateAvailable: boolean;
  currentVersion: string | null;
  currentRevision: string | null;
  latestVersion: string | null;
  latestTag: string | null;
  latestRevision: string | null;
  releaseUrl: string | null;
  windowsInstallerUrl: string | null;
  commandCenterUpdateAvailable: boolean;
  dirtyWorktree: boolean;
  message: string;
  status: LocalHostStatus;
}

export interface LocalHostLogsResult {
  target: "studio" | "portal" | "brain" | "landing" | "command-center";
  lines: string[];
}
