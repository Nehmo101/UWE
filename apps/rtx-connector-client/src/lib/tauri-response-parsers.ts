import { parseModelProfileStore } from "@uwe/connector-model-profile";

import type {
  CommandTestResult,
  ConnectorJobHistoryEntry,
  ConnectorPrinterProfile,
  ConnectorPrinterStore,
  CookbookDashboardView,
  CookbookFitLevel,
  CookbookGpuSummary,
  CookbookHardwareSummary,
  CookbookModelFit,
  CookbookModelView,
  CookbookRecommendationView,
  OllamaPullEvent,
  PullOllamaModelResult,
  RunnerId,
  RunnerProbeResult,
  RunnerStatus,
  RunnerTestResult,
  SpotifyAuthUrlResult,
  SpotifyDevice,
  SpotifyDevicesResult,
  SpotifyStatusResult,
  StartOllamaResult,
  OllamaSpeedResult,
} from "./tauri-types";

function nowTimestamp(): string {
  return new Date().toISOString();
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

export function parsePrinterProfile(raw: unknown): ConnectorPrinterProfile | null {
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

export function parsePrinterStore(raw: unknown): ConnectorPrinterStore {
  const value = asRecord(raw);
  const printers = Array.isArray(value.printers)
    ? value.printers.map(parsePrinterProfile).filter((p): p is ConnectorPrinterProfile => p !== null)
    : [];
  return {
    version: typeof value.version === "number" ? value.version : 1,
    printers,
  };
}
export function parseJobs(raw: unknown): ConnectorJobHistoryEntry[] {
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

export function parseLogs(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string") : [];
}

export function parsePullEvents(raw: unknown): OllamaPullEvent[] {
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

export function parsePullResult(raw: unknown): PullOllamaModelResult {
  const value = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    events: parsePullEvents(value.events),
    store: parseModelProfileStore(value.store),
  };
}
export function parseRunner(raw: unknown): RunnerProbeResult {
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

export function parseRunners(raw: unknown): RunnerProbeResult[] {
  const value = asRecord(raw);
  const runners = Array.isArray(value.runners) ? value.runners : Array.isArray(raw) ? raw : [];
  return runners.map(parseRunner);
}

export function parseSpeed(raw: unknown): OllamaSpeedResult | undefined {
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

export function parseRunnerTest(raw: unknown): RunnerTestResult {
  const base = parseRunner(raw);
  const speed = parseSpeed(asRecord(raw).speed);
  return speed ? { ...base, speed } : base;
}

export function parseStartOllama(raw: unknown): StartOllamaResult {
  const value = asRecord(raw);
  return {
    ok: asBool(value.ok),
    started: asBool(value.started),
    alreadyRunning: asBool(value.alreadyRunning),
    message: asString(value.message),
    triedPaths: asStringArray(value.triedPaths),
  };
}

export function parseFit(raw: unknown): CookbookModelFit {
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

export function parseGpu(raw: unknown): CookbookGpuSummary {
  const value = asRecord(raw);
  return {
    index: asNumber(value.index),
    name: asString(value.name, "GPU"),
    vramGb: asNumber(value.vramGb),
  };
}

export function parseGpus(raw: unknown): CookbookGpuSummary[] {
  return Array.isArray(raw) ? raw.map(parseGpu) : [];
}

export function parseHardware(raw: unknown): CookbookHardwareSummary {
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
    gpus: parseGpus(value.gpus),
    probeMessage: asString(value.probeMessage),
  };
}

export function parseRecommendation(raw: unknown): CookbookRecommendationView {
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

export function parseCookbookModel(raw: unknown): CookbookModelView {
  const value = asRecord(raw);
  return {
    id: asString(value.id),
    label: asString(value.label),
    family: asString(value.family),
    paramsB: asNumber(value.paramsB),
    contextLength: asNumber(value.contextLength),
    isMoe: asBool(value.isMoe),
    isMultimodal: asBool(value.isMultimodal),
    tags: asStringArray(value.tags),
    useCases: asStringArray(value.useCases),
    engines: asStringArray(value.engines),
    recommendedQuant: asString(value.recommendedQuant),
    minVramGbQ4: asNumber(value.minVramGbQ4),
    summary: asString(value.summary),
    strengthTier: asNumber(value.strengthTier),
    strengthLabel: asString(value.strengthLabel),
    installed: asBool(value.installed),
    fit: parseFit(value.fit),
  };
}

export function parseCookbookDashboard(raw: unknown): CookbookDashboardView {
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
export function parseSpotifyDevice(raw: unknown): SpotifyDevice {
  const value = asRecord(raw);
  return {
    id: asString(value.id),
    name: asString(value.name),
    type: asString(value.type),
    isActive: asBool(value.isActive),
    volumePercent: typeof value.volumePercent === "number" ? value.volumePercent : null,
  };
}

export function parseSpotifyDevices(raw: unknown): SpotifyDevicesResult {
  const value = asRecord(raw);
  return {
    ok: asBool(value.ok),
    connected: asBool(value.connected),
    devices: Array.isArray(value.devices) ? value.devices.map(parseSpotifyDevice) : [],
    deviceId: typeof value.deviceId === "string" ? value.deviceId : null,
    message: typeof value.message === "string" ? value.message : undefined,
  };
}

export function parseSpotifyStatus(raw: unknown): SpotifyStatusResult {
  const value = asRecord(raw);
  return { ok: asBool(value.ok), message: asString(value.message) };
}

export function parseAuthUrl(raw: unknown): SpotifyAuthUrlResult {
  const value = asRecord(raw);
  return { url: asString(value.url), state: asString(value.state) };
}

export function parseCommandTest(raw: unknown): CommandTestResult {
  const value = asRecord(raw);
  return {
    ok: asBool(value.ok),
    via: typeof value.via === "string" ? value.via : undefined,
    message: asString(value.message),
    output: typeof value.output === "string" ? value.output : undefined,
  };
}