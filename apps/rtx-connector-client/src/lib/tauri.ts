import { invoke } from "@tauri-apps/api/core";
import {
  defaultConnectorClientConfig,
  parseConnectorClientConfig,
  validateHostUrl,
  type ConnectorClientConfig,
  type ConnectorConnectionStatus,
  type ConnectorProcessStatus,
} from "@uwe/connector-client-config";
import {
  createModelProfile,
  defaultModelProfileStore,
  parseModelProfileStore,
  type ConnectorModelProfileStore,
} from "@uwe/connector-model-profile";

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

export interface CookbookHardwareSummary {
  platform: string;
  arch: string;
  cpuCores: number;
  ramGb: number;
  backend: string;
  gpuName: string | null;
  gpuVramGb: number;
  gpuCount: number;
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
  tags: string[];
  useCases: string[];
  engines: string[];
  recommendedQuant: string;
  minVramGbQ4: number;
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

const MOCK_CONFIG_KEY = "uwe-rtx-connector-client:mock-config";
const MOCK_RUNNING_KEY = "uwe-rtx-connector-client:mock-running";
const MOCK_MODEL_STORE_KEY = "uwe-rtx-connector-client:mock-model-store";
const MOCK_PRINTER_STORE_KEY = "uwe-rtx-connector-client:mock-printer-store";
const MOCK_LOGS_KEY = "uwe-rtx-connector-client:mock-logs";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function nowTimestamp(): string {
  return new Date().toISOString();
}

function readMockConfig(): ConnectorClientConfig {
  const raw = localStorage.getItem(MOCK_CONFIG_KEY);

  if (!raw) {
    return defaultConnectorClientConfig();
  }

  try {
    return parseConnectorClientConfig(JSON.parse(raw));
  } catch {
    return defaultConnectorClientConfig();
  }
}

function writeMockConfig(config: ConnectorClientConfig): ConnectorClientConfig {
  const parsed = parseConnectorClientConfig(config);
  localStorage.setItem(MOCK_CONFIG_KEY, JSON.stringify(parsed));
  return parsed;
}

function readMockRunning(): boolean {
  return localStorage.getItem(MOCK_RUNNING_KEY) === "true";
}

function writeMockRunning(running: boolean): void {
  localStorage.setItem(MOCK_RUNNING_KEY, String(running));
}

function readMockModelStore(): ConnectorModelProfileStore {
  const raw = localStorage.getItem(MOCK_MODEL_STORE_KEY);

  if (!raw) {
    return defaultModelProfileStore();
  }

  try {
    return parseModelProfileStore(JSON.parse(raw));
  } catch {
    return defaultModelProfileStore();
  }
}

function writeMockModelStore(store: ConnectorModelProfileStore): ConnectorModelProfileStore {
  const parsed = parseModelProfileStore(store);
  localStorage.setItem(MOCK_MODEL_STORE_KEY, JSON.stringify(parsed));
  return parsed;
}

function parsePrinterProfile(raw: unknown): ConnectorPrinterProfile | null {
  const value = asRecord(raw);
  const id = asString(value.id).trim();
  const name = asString(value.name).trim();
  if (!id || !name) {
    return null;
  }
  const printer: ConnectorPrinterProfile = { id, name, enabledForUwe: asBool(value.enabledForUwe) };
  if (typeof value.description === "string" && value.description.trim()) {
    printer.description = value.description;
  }
  if (typeof value.isDefault === "boolean") printer.isDefault = value.isDefault;
  if (typeof value.state === "string" && value.state.trim()) printer.state = value.state;
  return printer;
}

function parsePrinterStore(raw: unknown): ConnectorPrinterStore {
  const value = asRecord(raw);
  const printers = Array.isArray(value.printers)
    ? value.printers.map(parsePrinterProfile).filter((p): p is ConnectorPrinterProfile => p !== null)
    : [];
  return {
    version: typeof value.version === "number" ? value.version : 1,
    printers,
  };
}

function readMockPrinterStore(): ConnectorPrinterStore {
  const raw = localStorage.getItem(MOCK_PRINTER_STORE_KEY);
  if (!raw) {
    return { version: 1, printers: [] };
  }
  try {
    return parsePrinterStore(JSON.parse(raw));
  } catch {
    return { version: 1, printers: [] };
  }
}

function writeMockPrinterStore(store: ConnectorPrinterStore): ConnectorPrinterStore {
  const parsed = parsePrinterStore(store);
  localStorage.setItem(MOCK_PRINTER_STORE_KEY, JSON.stringify(parsed));
  return parsed;
}

function readMockLogs(): string[] {
  const raw = localStorage.getItem(MOCK_LOGS_KEY);
  if (!raw) {
    const fallback = [
      "[connection] Browser-Vorschau aktiv.",
      "[models] Keine echten lokalen Modelle ohne Tauri-Shell.",
      "[jobs] Job-Historie ist im Browser-Mock statisch.",
    ];
    localStorage.setItem(MOCK_LOGS_KEY, JSON.stringify(fallback));
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function appendMockLog(line: string): void {
  const next = [...readMockLogs(), line].slice(-200);
  localStorage.setItem(MOCK_LOGS_KEY, JSON.stringify(next));
}

function parseJobs(raw: unknown): ConnectorJobHistoryEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : "unknown",
      type: typeof entry.type === "string" ? entry.type : "unknown",
      lane: typeof entry.lane === "string" ? entry.lane : "default",
      status: entry.status === "failed" ? "failed" : "completed",
      durationMs: typeof entry.durationMs === "number" ? entry.durationMs : 0,
      reason: typeof entry.reason === "string" ? entry.reason : undefined,
      finishedAt: typeof entry.finishedAt === "string" ? entry.finishedAt : nowTimestamp(),
    }));
}

function parseLogs(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string") : [];
}

function parsePullEvents(raw: unknown): OllamaPullEvent[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const events: OllamaPullEvent[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const value = entry as Record<string, unknown>;
    if (value.type === "done" && typeof value.name === "string") {
      events.push({ type: "done", name: value.name });
      continue;
    }

    if (value.type === "progress") {
      events.push({
        type: "progress",
        status: typeof value.status === "string" ? value.status : "",
        digest: typeof value.digest === "string" ? value.digest : undefined,
        total: typeof value.total === "number" ? value.total : undefined,
        completed: typeof value.completed === "number" ? value.completed : undefined,
        fraction: typeof value.fraction === "number" ? value.fraction : undefined,
      });
    }
  }

  return events;
}

function parsePullResult(raw: unknown): PullOllamaModelResult {
  const value = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    events: parsePullEvents(value.events),
    store: parseModelProfileStore(value.store),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const RUNNER_IDS: RunnerId[] = ["ollama", "lm_studio", "llama_cpp"];
const RUNNER_STATUSES: RunnerStatus[] = ["online", "offline", "error"];

function parseRunner(raw: unknown): RunnerProbeResult {
  const value = asRecord(raw);
  const id = RUNNER_IDS.includes(value.id as RunnerId) ? (value.id as RunnerId) : "ollama";
  const status = RUNNER_STATUSES.includes(value.status as RunnerStatus)
    ? (value.status as RunnerStatus)
    : "error";
  return {
    id,
    label: asString(value.label, id),
    endpoint: asString(value.endpoint),
    healthPath: asString(value.healthPath),
    status,
    modelCount: typeof value.modelCount === "number" ? value.modelCount : null,
    models: asStringArray(value.models),
    message: asString(value.message),
  };
}

function parseRunners(raw: unknown): RunnerProbeResult[] {
  const value = asRecord(raw);
  const runners = Array.isArray(value.runners) ? value.runners : Array.isArray(raw) ? raw : [];
  return runners.map(parseRunner);
}

function parseSpeed(raw: unknown): OllamaSpeedResult | undefined {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const value = asRecord(raw);
  return {
    ok: asBool(value.ok),
    model: asString(value.model),
    tokensPerSecond: typeof value.tokensPerSecond === "number" ? value.tokensPerSecond : null,
    evalCount: typeof value.evalCount === "number" ? value.evalCount : null,
    message: asString(value.message),
  };
}

function parseRunnerTest(raw: unknown): RunnerTestResult {
  const base = parseRunner(raw);
  const speed = parseSpeed(asRecord(raw).speed);
  return speed ? { ...base, speed } : base;
}

function parseStartOllama(raw: unknown): StartOllamaResult {
  const value = asRecord(raw);
  return {
    ok: asBool(value.ok),
    started: asBool(value.started),
    alreadyRunning: asBool(value.alreadyRunning),
    message: asString(value.message),
    triedPaths: asStringArray(value.triedPaths),
  };
}

function parseFit(raw: unknown): CookbookModelFit {
  const value = asRecord(raw);
  const level = value.level as CookbookFitLevel;
  return {
    modelId: asString(value.modelId),
    score: asNumber(value.score),
    level: level ?? "unsupported",
    estimatedVramGb: asNumber(value.estimatedVramGb),
    estimatedRamGb: asNumber(value.estimatedRamGb),
    fitsGpu: asBool(value.fitsGpu),
    fitsRam: asBool(value.fitsRam),
    notes: asStringArray(value.notes),
  };
}

function parseHardware(raw: unknown): CookbookHardwareSummary {
  const value = asRecord(raw);
  return {
    platform: asString(value.platform, "unknown"),
    arch: asString(value.arch, "unknown"),
    cpuCores: asNumber(value.cpuCores),
    ramGb: asNumber(value.ramGb),
    backend: asString(value.backend, "cpu"),
    gpuName: typeof value.gpuName === "string" ? value.gpuName : null,
    gpuVramGb: asNumber(value.gpuVramGb),
    gpuCount: asNumber(value.gpuCount),
    probeMessage: asString(value.probeMessage),
  };
}

function parseRecommendation(raw: unknown): CookbookRecommendationView {
  const value = asRecord(raw);
  return {
    useCase: asString(value.useCase),
    label: asString(value.label),
    description: asString(value.description),
    modelId: asString(value.modelId),
    modelLabel: asString(value.modelLabel),
    engineId: asString(value.engineId),
    fit: parseFit(value.fit),
    privacyNote: asString(value.privacyNote),
  };
}

function parseCookbookModel(raw: unknown): CookbookModelView {
  const value = asRecord(raw);
  return {
    id: asString(value.id),
    label: asString(value.label),
    family: asString(value.family),
    paramsB: asNumber(value.paramsB),
    tags: asStringArray(value.tags),
    useCases: asStringArray(value.useCases),
    engines: asStringArray(value.engines),
    recommendedQuant: asString(value.recommendedQuant),
    minVramGbQ4: asNumber(value.minVramGbQ4),
    installed: asBool(value.installed),
    fit: parseFit(value.fit),
  };
}

function parseCookbookDashboard(raw: unknown): CookbookDashboardView {
  const value = asRecord(raw);
  return {
    hardware: parseHardware(value.hardware),
    installedModels: asStringArray(value.installedModels),
    recommendations: Array.isArray(value.recommendations)
      ? value.recommendations.map(parseRecommendation)
      : [],
    models: Array.isArray(value.models) ? value.models.map(parseCookbookModel) : [],
  };
}

function deriveConnectionStatus(
  config: ConnectorClientConfig,
  running: boolean,
): ConnectorConnectionStatus {
  if (!config.hostUrl || !config.token) {
    return "not_configured";
  }

  return running ? "connected" : "ready";
}

function buildMockRuntimeStatus(): ConnectorRuntimeStatus {
  const config = readMockConfig();
  const running = readMockRunning();

  return {
    status: running ? "running" : "stopped",
    message: running
      ? "Browser-Vorschau: Connector-Stub laeuft lokal im UI-Modus."
      : "Browser-Vorschau: Connector-Stub ist gestoppt.",
    connectionStatus: deriveConnectionStatus(config, running),
    lastHeartbeatAt: running ? nowTimestamp() : null,
  };
}

function buildMockRunners(): RunnerProbeResult[] {
  return [
    {
      id: "ollama",
      label: "Ollama",
      endpoint: "http://127.0.0.1:11434",
      healthPath: "/api/tags",
      status: "offline",
      modelCount: null,
      models: [],
      message: "Browser-Vorschau: kein echter Runner ohne Tauri-Shell.",
    },
    {
      id: "lm_studio",
      label: "LM Studio",
      endpoint: "http://127.0.0.1:1234",
      healthPath: "/v1/models",
      status: "offline",
      modelCount: null,
      models: [],
      message: "Browser-Vorschau: kein echter Runner ohne Tauri-Shell.",
    },
    {
      id: "llama_cpp",
      label: "llama.cpp",
      endpoint: "http://127.0.0.1:8080",
      healthPath: "/v1/models",
      status: "offline",
      modelCount: null,
      models: [],
      message: "Browser-Vorschau: kein echter Runner ohne Tauri-Shell.",
    },
  ];
}

function mockFit(modelId: string, score: number, level: CookbookFitLevel): CookbookModelFit {
  return {
    modelId,
    score,
    level,
    estimatedVramGb: 6,
    estimatedRamGb: 9,
    fitsGpu: level !== "unsupported" && level !== "poor",
    fitsRam: true,
    notes: ["Browser-Vorschauwerte — echte Schätzung nur in der Tauri-App."],
  };
}

function buildMockCookbookDashboard(): CookbookDashboardView {
  return {
    hardware: {
      platform: "browser",
      arch: "preview",
      cpuCores: 8,
      ramGb: 32,
      backend: "cpu",
      gpuName: null,
      gpuVramGb: 0,
      gpuCount: 0,
      probeMessage: "Browser-Vorschau — echte Hardware-Erkennung nur in der Tauri-App.",
    },
    installedModels: [],
    recommendations: [
      {
        useCase: "dnd_generator",
        label: "DnD Generator",
        description: "NPCs, Orte, Encounters und Dungeon-Räume generieren.",
        modelId: "llama3.1:8b",
        modelLabel: "Llama 3.1 8B",
        engineId: "ollama",
        fit: mockFit("llama3.1:8b", 72, "good"),
        privacyNote: "Bei privatem Kontext Cloud-Provider blockiert.",
      },
    ],
    models: [
      {
        id: "llama3.1:8b",
        label: "Llama 3.1 8B",
        family: "llama",
        paramsB: 8,
        tags: ["balanced", "general"],
        useCases: ["dnd_generator", "session_prep"],
        engines: ["ollama", "lm_studio"],
        recommendedQuant: "Q4_K_M",
        minVramGbQ4: 5.5,
        installed: false,
        fit: mockFit("llama3.1:8b", 72, "good"),
      },
    ],
  };
}

function parseSpotifyDevice(raw: unknown): SpotifyDevice {
  const value = asRecord(raw);
  return {
    id: asString(value.id),
    name: asString(value.name),
    type: asString(value.type),
    isActive: asBool(value.isActive),
    volumePercent: typeof value.volumePercent === "number" ? value.volumePercent : null,
  };
}

function parseSpotifyDevices(raw: unknown): SpotifyDevicesResult {
  const value = asRecord(raw);
  return {
    ok: asBool(value.ok),
    connected: asBool(value.connected),
    devices: Array.isArray(value.devices) ? value.devices.map(parseSpotifyDevice) : [],
    deviceId: typeof value.deviceId === "string" ? value.deviceId : null,
    message: typeof value.message === "string" ? value.message : undefined,
  };
}

function parseSpotifyStatus(raw: unknown): SpotifyStatusResult {
  const value = asRecord(raw);
  return { ok: asBool(value.ok), message: asString(value.message) };
}

function parseAuthUrl(raw: unknown): SpotifyAuthUrlResult {
  const value = asRecord(raw);
  return { url: asString(value.url), state: asString(value.state) };
}

function parseCommandTest(raw: unknown): CommandTestResult {
  const value = asRecord(raw);
  return {
    ok: asBool(value.ok),
    via: typeof value.via === "string" ? value.via : undefined,
    message: asString(value.message),
    output: typeof value.output === "string" ? value.output : undefined,
  };
}

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauriRuntime()) {
    return invoke<T>(command, args);
  }

  switch (command) {
    case "read_config":
      return readMockConfig() as T;
    case "write_config": {
      const config = writeMockConfig(args?.config as ConnectorClientConfig);
      return config as T;
    }
    case "get_connector_status":
      return buildMockRuntimeStatus() as T;
    case "start_connector": {
      writeMockRunning(true);
      return buildMockRuntimeStatus() as T;
    }
    case "stop_connector": {
      writeMockRunning(false);
      return buildMockRuntimeStatus() as T;
    }
    case "test_host_connection": {
      const hostUrl = typeof args?.hostUrl === "string" ? args.hostUrl : "";
      const token = typeof args?.token === "string" ? args.token : "";
      const validation = validateHostUrl(hostUrl);

      if (!validation.ok) {
        return {
          ok: false,
          status: "error",
          message: validation.reason,
          checkedAt: nowTimestamp(),
        } as T;
      }

      if (!token.trim()) {
        return {
          ok: false,
          status: "not_configured",
          message: "Connector-Token fehlt für den Verbindungstest.",
          checkedAt: nowTimestamp(),
        } as T;
      }

      return {
        ok: true,
        status: "ready",
        message: `Browser-Vorschau: Host ${validation.normalized} und Token-Format sehen gültig aus.`,
        checkedAt: nowTimestamp(),
      } as T;
    }
    case "get_model_store":
      return readMockModelStore() as T;
    case "save_model_store": {
      const store = writeMockModelStore(args?.store as ConnectorModelProfileStore);
      appendMockLog(`[models] Model-Store gespeichert (${store.profiles.length} Profile).`);
      return store as T;
    }
    case "scan_models": {
      const current = readMockModelStore();
      const profiles =
        current.profiles.length > 0
          ? current.profiles
          : [
              createModelProfile({
                provider: "ollama",
                source: "discovery",
                name: "llama3.1:8b",
                displayName: "llama3.1:8b",
                description: "Browser-Vorschauprofil für P1.",
                modelType: "chat",
              }),
            ];
      const store = writeMockModelStore({ ...current, profiles });
      appendMockLog(`[models] Scan ausgeführt (${store.profiles.length} Profile).`);
      return store as T;
    }
    case "get_printer_store":
      return readMockPrinterStore() as T;
    case "save_printer_store": {
      const store = writeMockPrinterStore(args?.store as ConnectorPrinterStore);
      appendMockLog(`[printers] Drucker-Store gespeichert (${store.printers.length} Drucker).`);
      return store as T;
    }
    case "scan_printers": {
      const current = readMockPrinterStore();
      const printers =
        current.printers.length > 0
          ? current.printers
          : [
              { id: "zebra-lp2844", name: "Zebra LP 2844 Label", state: "idle", enabledForUwe: false },
              { id: "hp-laserjet", name: "HP LaserJet", isDefault: true, state: "idle", enabledForUwe: false },
            ];
      const store = writeMockPrinterStore({ ...current, printers });
      appendMockLog(`[printers] Drucker-Scan simuliert (${store.printers.length} Drucker).`);
      return store as T;
    }
    case "pull_ollama_model": {
      const current = readMockModelStore();
      const name = typeof args?.name === "string" ? args.name.trim() : "";
      if (!name) {
        throw new Error("Mock pull: Modellname fehlt.");
      }

      const existing = current.profiles.find((profile) => profile.provider === "ollama" && profile.name === name);
      const store = writeMockModelStore({
        ...current,
        profiles: existing
          ? current.profiles
          : [
              ...current.profiles,
              createModelProfile({
                provider: "ollama",
                source: "discovery",
                name,
                displayName: name,
                description: "Per Browser-Mock hinzugefügt.",
                modelType: "chat",
              }),
            ],
      });

      const result: PullOllamaModelResult = {
        events: [
          { type: "progress", status: "pulling manifest", fraction: 0.15 },
          { type: "progress", status: "downloading layers", fraction: 0.72 },
          { type: "done", name },
        ],
        store,
      };
      appendMockLog(`[downloads] Ollama pull simuliert: ${name}`);
      return result as T;
    }
    case "list_connector_jobs":
      return [
        {
          id: "mock-job-1",
          type: "llm.generate",
          lane: "gpu",
          status: "completed",
          durationMs: 1820,
          finishedAt: nowTimestamp(),
        },
      ] as T;
    case "list_connector_logs": {
      const category = typeof args?.category === "string" ? args.category.trim() : "";
      const lines = readMockLogs();
      return (category ? lines.filter((line) => line.includes(`[${category}]`)) : lines) as T;
    }
    case "cookbook_dashboard":
      return buildMockCookbookDashboard() as T;
    case "probe_runners":
      return { runners: buildMockRunners() } as T;
    case "start_ollama":
      return {
        ok: false,
        started: false,
        alreadyRunning: false,
        message:
          "Browser-Vorschau: Ollama-Start ist nur in der Tauri-App auf dem RTX-PC verfügbar.",
        triedPaths: [],
      } as T;
    case "test_runner": {
      const id = typeof args?.runner === "string" ? args.runner.trim() : "ollama";
      const runner = buildMockRunners().find((entry) => entry.id === id) ?? buildMockRunners()[0];
      return runner as T;
    }
    case "spotify_auth_url": {
      const config = readMockConfig();
      if (!config.spotifyClientId) {
        throw new Error("Spotify-Client-ID fehlt — zuerst speichern.");
      }
      const params = new URLSearchParams({
        response_type: "code",
        client_id: config.spotifyClientId,
        redirect_uri: config.spotifyRedirectUri,
        scope: "user-modify-playback-state user-read-playback-state",
        state: "browser-preview",
        show_dialog: "false",
      });
      return {
        url: `https://accounts.spotify.com/authorize?${params.toString()}`,
        state: "browser-preview",
      } as T;
    }
    case "spotify_exchange_code":
      return {
        ok: false,
        message: "Browser-Vorschau: Spotify-Login funktioniert nur in der Tauri-App.",
      } as T;
    case "spotify_devices":
      return {
        ok: false,
        connected: false,
        devices: [],
        deviceId: null,
        message: "Browser-Vorschau: keine echten Spotify-Geräte ohne Tauri-Shell.",
      } as T;
    case "spotify_set_device":
      return { ok: false, message: "Browser-Vorschau: Spotify nicht verbunden." } as T;
    case "spotify_test":
      return { ok: false, message: "Browser-Vorschau: Spotify nicht verbunden." } as T;
    case "spotify_disconnect":
      return { ok: true, message: "Spotify getrennt (Browser-Vorschau)." } as T;
    case "test_audio": {
      const config = readMockConfig();
      return {
        ok: false,
        message: config.audioCommand
          ? "Browser-Vorschau: Audio-Test läuft nur in der Tauri-App auf dem RTX-PC."
          : "Kein Audio-Kommando konfiguriert.",
      } as T;
    }
    case "test_image": {
      const config = readMockConfig();
      return {
        ok: false,
        message: config.imageCommand
          ? "Browser-Vorschau: Image-Test läuft nur in der Tauri-App auf dem RTX-PC."
          : "Kein Image-Kommando konfiguriert.",
      } as T;
    }
    default:
      throw new Error(`Unbekannter Mock-Befehl: ${command}`);
  }
}

export async function readConfig(): Promise<ConnectorClientConfig> {
  return invokeCommand<ConnectorClientConfig>("read_config");
}

export async function writeConfig(config: ConnectorClientConfig): Promise<ConnectorClientConfig> {
  return invokeCommand<ConnectorClientConfig>("write_config", { config });
}

export async function getConnectorStatus(): Promise<ConnectorRuntimeStatus> {
  return invokeCommand<ConnectorRuntimeStatus>("get_connector_status");
}

export async function startConnector(): Promise<ConnectorRuntimeStatus> {
  return invokeCommand<ConnectorRuntimeStatus>("start_connector");
}

export async function stopConnector(): Promise<ConnectorRuntimeStatus> {
  return invokeCommand<ConnectorRuntimeStatus>("stop_connector");
}

export async function testHostConnection(
  hostUrl: string,
  token?: string,
): Promise<HostConnectionTestResult> {
  return invokeCommand<HostConnectionTestResult>("test_host_connection", { hostUrl, token });
}

export async function getModelStore(): Promise<ConnectorModelProfileStore> {
  return parseModelProfileStore(await invokeCommand<unknown>("get_model_store"));
}

export async function saveModelStore(
  store: ConnectorModelProfileStore,
): Promise<ConnectorModelProfileStore> {
  return parseModelProfileStore(await invokeCommand<unknown>("save_model_store", { store }));
}

export async function scanModels(): Promise<ConnectorModelProfileStore> {
  return parseModelProfileStore(await invokeCommand<unknown>("scan_models"));
}

export async function getPrinterStore(): Promise<ConnectorPrinterStore> {
  return parsePrinterStore(await invokeCommand<unknown>("get_printer_store"));
}

export async function savePrinterStore(
  store: ConnectorPrinterStore,
): Promise<ConnectorPrinterStore> {
  return parsePrinterStore(await invokeCommand<unknown>("save_printer_store", { store }));
}

export async function scanPrinters(): Promise<ConnectorPrinterStore> {
  return parsePrinterStore(await invokeCommand<unknown>("scan_printers"));
}

export async function pullOllamaModel(name: string): Promise<PullOllamaModelResult> {
  return parsePullResult(await invokeCommand<unknown>("pull_ollama_model", { name }));
}

export async function listConnectorJobs(): Promise<ConnectorJobHistoryEntry[]> {
  return parseJobs(await invokeCommand<unknown>("list_connector_jobs"));
}

export async function listConnectorLogs(category?: string): Promise<string[]> {
  return parseLogs(await invokeCommand<unknown>("list_connector_logs", { category }));
}

export async function getCookbookDashboard(): Promise<CookbookDashboardView> {
  return parseCookbookDashboard(await invokeCommand<unknown>("cookbook_dashboard"));
}

export async function probeRunners(): Promise<RunnerProbeResult[]> {
  return parseRunners(await invokeCommand<unknown>("probe_runners"));
}

export async function startOllama(): Promise<StartOllamaResult> {
  return parseStartOllama(await invokeCommand<unknown>("start_ollama"));
}

export async function testRunner(runner?: RunnerId): Promise<RunnerTestResult> {
  return parseRunnerTest(await invokeCommand<unknown>("test_runner", { runner }));
}

export async function spotifyAuthUrl(): Promise<SpotifyAuthUrlResult> {
  return parseAuthUrl(await invokeCommand<unknown>("spotify_auth_url"));
}

export async function spotifyExchangeCode(code: string): Promise<SpotifyStatusResult> {
  return parseSpotifyStatus(await invokeCommand<unknown>("spotify_exchange_code", { code }));
}

export async function spotifyDevices(): Promise<SpotifyDevicesResult> {
  return parseSpotifyDevices(await invokeCommand<unknown>("spotify_devices"));
}

export async function spotifySetDevice(deviceId: string | null): Promise<SpotifyStatusResult> {
  return parseSpotifyStatus(await invokeCommand<unknown>("spotify_set_device", { deviceId }));
}

export async function spotifyTest(action?: "play" | "pause"): Promise<SpotifyStatusResult> {
  return parseSpotifyStatus(await invokeCommand<unknown>("spotify_test", { action }));
}

export async function spotifyDisconnect(): Promise<SpotifyStatusResult> {
  return parseSpotifyStatus(await invokeCommand<unknown>("spotify_disconnect"));
}

export async function testAudio(source?: string): Promise<CommandTestResult> {
  return parseCommandTest(await invokeCommand<unknown>("test_audio", { source }));
}

export async function testImage(prompt?: string): Promise<CommandTestResult> {
  return parseCommandTest(await invokeCommand<unknown>("test_image", { prompt }));
}
