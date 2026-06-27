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

const MOCK_CONFIG_KEY = "uwe-rtx-connector-client:mock-config";
const MOCK_RUNNING_KEY = "uwe-rtx-connector-client:mock-running";
const MOCK_MODEL_STORE_KEY = "uwe-rtx-connector-client:mock-model-store";
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

export async function pullOllamaModel(name: string): Promise<PullOllamaModelResult> {
  return parsePullResult(await invokeCommand<unknown>("pull_ollama_model", { name }));
}

export async function listConnectorJobs(): Promise<ConnectorJobHistoryEntry[]> {
  return parseJobs(await invokeCommand<unknown>("list_connector_jobs"));
}

export async function listConnectorLogs(category?: string): Promise<string[]> {
  return parseLogs(await invokeCommand<unknown>("list_connector_logs", { category }));
}
