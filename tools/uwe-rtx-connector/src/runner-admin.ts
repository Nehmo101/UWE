/**
 * Runner administration — probe and start local inference runners.
 *
 * Provides best-effort, offline-safe helpers used by the desktop client's
 * "Runner" page (P2 visibility):
 *
 *   • `probeRunners`            — health-check Ollama, LM Studio, llama.cpp.
 *   • `startOllamaOnWindows`    — try to launch the local Ollama service.
 *   • `measureOllamaTokensPerSecond` — rough throughput sample for one model.
 *
 * Everything is local to the connector machine: only model metadata exposed by
 * the local servers is ever read; no world/brain/job data leaves the machine.
 */

import { spawn, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";

export type RunnerId = "ollama" | "lm_studio" | "llama_cpp";

export type RunnerStatus = "online" | "offline" | "error";

export interface RunnerProbeResult {
  id: RunnerId;
  label: string;
  endpoint: string;
  healthPath: string;
  status: RunnerStatus;
  /** Number of models reported by the runner, or null when offline/error. */
  modelCount: number | null;
  /** Model ids/names reported by the runner. */
  models: string[];
  /** German, user-friendly status message. */
  message: string;
}

export interface RunnerAdminConfig {
  ollamaUrl: string;
  lmStudioUrl: string;
  llamaCppUrl: string;
  timeoutMs: number;
}

const RUNNER_META: Record<RunnerId, { label: string; healthPath: string }> = {
  ollama: { label: "Ollama", healthPath: "/api/tags" },
  lm_studio: { label: "LM Studio", healthPath: "/v1/models" },
  llama_cpp: { label: "llama.cpp", healthPath: "/v1/models" },
};

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Resolve runner endpoints from the environment, falling back to the common
 * localhost defaults (Ollama 11434, LM Studio 1234, llama.cpp 8080).
 */
export function resolveRunnerConfig(env: NodeJS.ProcessEnv = process.env): RunnerAdminConfig {
  return {
    ollamaUrl: env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434",
    lmStudioUrl: env.LM_STUDIO_BASE_URL?.trim() || "http://127.0.0.1:1234",
    llamaCppUrl: env.LLAMACPP_BASE_URL?.trim() || "http://127.0.0.1:8080",
    timeoutMs: 2500,
  };
}

function endpointForRunner(id: RunnerId, config: RunnerAdminConfig): string {
  switch (id) {
    case "ollama":
      return config.ollamaUrl;
    case "lm_studio":
      return config.lmStudioUrl;
    case "llama_cpp":
      return config.llamaCppUrl;
  }
}

function classifyError(error: unknown): { status: RunnerStatus; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  // A connection refused / timeout is the normal "not running" case.
  if (/timed out|timeout|fetch failed|ECONNREFUSED|ENOTFOUND|HTTP 4|HTTP 5/i.test(raw)) {
    return { status: "offline", message: "Runner ist nicht erreichbar (nicht gestartet?)." };
  }
  return { status: "error", message: `Fehler beim Prüfen: ${raw.slice(0, 160)}` };
}

async function probeOllamaRunner(
  endpoint: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<RunnerProbeResult> {
  const base = trimSlash(endpoint);
  try {
    const response = await fetchImpl(`${base}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { models?: Array<{ name?: string }> };
    const models = (payload.models ?? [])
      .map((entry) => entry.name?.trim())
      .filter((name): name is string => Boolean(name));
    return {
      id: "ollama",
      label: RUNNER_META.ollama.label,
      endpoint: base,
      healthPath: RUNNER_META.ollama.healthPath,
      status: "online",
      modelCount: models.length,
      models,
      message:
        models.length > 0
          ? `Online — ${models.length} Modell(e) verfügbar.`
          : "Online — noch keine Modelle geladen.",
    };
  } catch (error) {
    const { status, message } = classifyError(error);
    return {
      id: "ollama",
      label: RUNNER_META.ollama.label,
      endpoint: base,
      healthPath: RUNNER_META.ollama.healthPath,
      status,
      modelCount: null,
      models: [],
      message,
    };
  }
}

async function probeOpenAiCompatibleRunner(
  id: "lm_studio" | "llama_cpp",
  endpoint: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<RunnerProbeResult> {
  const base = trimSlash(endpoint);
  const meta = RUNNER_META[id];
  try {
    const response = await fetchImpl(`${base}/v1/models`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
    const models = (payload.data ?? [])
      .map((entry) => entry.id?.trim())
      .filter((value): value is string => Boolean(value));
    return {
      id,
      label: meta.label,
      endpoint: base,
      healthPath: meta.healthPath,
      status: "online",
      modelCount: models.length,
      models,
      message:
        models.length > 0
          ? `Online — ${models.length} Modell(e) verfügbar.`
          : "Online — kein Modell geladen.",
    };
  } catch (error) {
    const { status, message } = classifyError(error);
    return {
      id,
      label: meta.label,
      endpoint: base,
      healthPath: meta.healthPath,
      status,
      modelCount: null,
      models: [],
      message,
    };
  }
}

/** Probe a single runner by id. Best-effort and offline-safe. */
export async function probeRunner(
  id: RunnerId,
  config: RunnerAdminConfig = resolveRunnerConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<RunnerProbeResult> {
  const endpoint = endpointForRunner(id, config);
  if (id === "ollama") {
    return probeOllamaRunner(endpoint, config.timeoutMs, fetchImpl);
  }
  return probeOpenAiCompatibleRunner(id, endpoint, config.timeoutMs, fetchImpl);
}

/**
 * Probe all known local runners in parallel. Returns one entry per runner with
 * its online/offline status and model list.
 */
export async function probeRunners(
  config: RunnerAdminConfig = resolveRunnerConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<RunnerProbeResult[]> {
  return Promise.all([
    probeRunner("ollama", config, fetchImpl),
    probeRunner("lm_studio", config, fetchImpl),
    probeRunner("llama_cpp", config, fetchImpl),
  ]);
}

export interface StartOllamaResult {
  ok: boolean;
  started: boolean;
  alreadyRunning: boolean;
  message: string;
  /** Executable paths that were attempted (Windows only). */
  triedPaths: string[];
}

export interface StartOllamaOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  config?: RunnerAdminConfig;
  fetchImpl?: typeof fetch;
  /** Returns true when a candidate executable exists on disk. */
  existsImpl?: (path: string) => boolean;
  /** Spawn the detached process. Returns false when the spawn fails. */
  spawnImpl?: (command: string, args: string[]) => boolean;
}

/** Common Windows install locations for the Ollama executables. */
function windowsOllamaCandidates(env: NodeJS.ProcessEnv): Array<{ path: string; args: string[] }> {
  const programFiles = env.ProgramFiles?.trim() || "C:\\Program Files";
  const localAppData = env.LOCALAPPDATA?.trim();

  const candidates: Array<{ path: string; args: string[] }> = [
    { path: `${programFiles}\\Ollama\\ollama.exe`, args: ["serve"] },
  ];

  if (localAppData) {
    candidates.push({
      path: `${localAppData}\\Programs\\Ollama\\ollama.exe`,
      args: ["serve"],
    });
    // The tray application boots the background service without a console.
    candidates.push({
      path: `${localAppData}\\Programs\\Ollama\\ollama app.exe`,
      args: [],
    });
  }

  // The desktop tray app installed for all users.
  candidates.push({ path: `${programFiles}\\Ollama\\ollama app.exe`, args: [] });

  return candidates;
}

function defaultSpawn(command: string, args: string[]): boolean {
  try {
    const options: SpawnOptions = { detached: true, stdio: "ignore", windowsHide: true };
    const child = spawn(command, args, options);
    child.on("error", () => {
      /* swallow — reported via the boolean return / later probe */
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to start the local Ollama service on Windows. No-op (with a friendly
 * message) on other platforms. When Ollama already answers on its endpoint the
 * call short-circuits and reports `alreadyRunning`.
 */
export async function startOllamaOnWindows(
  options: StartOllamaOptions = {},
): Promise<StartOllamaResult> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const config = options.config ?? resolveRunnerConfig(env);
  const fetchImpl = options.fetchImpl ?? fetch;
  const existsImpl = options.existsImpl ?? existsSync;
  const spawnImpl = options.spawnImpl ?? defaultSpawn;

  // Already running anywhere (Windows or not)? Nothing to do.
  const probe = await probeRunner("ollama", config, fetchImpl);
  if (probe.status === "online") {
    return {
      ok: true,
      started: false,
      alreadyRunning: true,
      message: "Ollama läuft bereits — kein Start nötig.",
      triedPaths: [],
    };
  }

  if (platform !== "win32") {
    return {
      ok: false,
      started: false,
      alreadyRunning: false,
      message:
        "Automatischer Start ist nur unter Windows verfügbar. Starte Ollama manuell mit `ollama serve`.",
      triedPaths: [],
    };
  }

  const candidates = windowsOllamaCandidates(env);
  const triedPaths: string[] = [];

  for (const candidate of candidates) {
    triedPaths.push(candidate.path);
    if (!existsImpl(candidate.path)) {
      continue;
    }
    const launched = spawnImpl(candidate.path, candidate.args);
    if (launched) {
      return {
        ok: true,
        started: true,
        alreadyRunning: false,
        message: `Ollama wird gestartet (${candidate.path}). Bitte einige Sekunden warten und erneut prüfen.`,
        triedPaths,
      };
    }
  }

  return {
    ok: false,
    started: false,
    alreadyRunning: false,
    message:
      "Ollama-Programm nicht gefunden. Bitte von https://ollama.com/download installieren oder manuell starten.",
    triedPaths,
  };
}

export interface OllamaSpeedResult {
  ok: boolean;
  model: string;
  tokensPerSecond: number | null;
  evalCount: number | null;
  message: string;
}

const DEFAULT_SPEED_PROMPT = "Antworte mit einem kurzen Satz: Was ist UWE?";

/**
 * Best-effort throughput sample for a model via Ollama's `/api/generate`. Uses
 * the `eval_count` / `eval_duration` (nanoseconds) fields of the non-streamed
 * response. Returns `tokensPerSecond: null` on any failure rather than throwing.
 */
export async function measureOllamaTokensPerSecond(
  model: string,
  prompt: string = DEFAULT_SPEED_PROMPT,
  options: { config?: RunnerAdminConfig; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<OllamaSpeedResult> {
  const trimmedModel = model.trim();
  if (!trimmedModel) {
    return {
      ok: false,
      model,
      tokensPerSecond: null,
      evalCount: null,
      message: "Modellname fehlt.",
    };
  }

  const config = options.config ?? resolveRunnerConfig();
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = trimSlash(config.ollamaUrl);
  const timeoutMs = options.timeoutMs ?? 60_000;

  try {
    const response = await fetchImpl(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: trimmedModel, prompt, stream: false }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      eval_count?: number;
      eval_duration?: number;
    };
    const evalCount = typeof payload.eval_count === "number" ? payload.eval_count : null;
    const evalDurationNs =
      typeof payload.eval_duration === "number" ? payload.eval_duration : null;

    if (evalCount === null || evalDurationNs === null || evalDurationNs <= 0) {
      return {
        ok: false,
        model: trimmedModel,
        tokensPerSecond: null,
        evalCount,
        message: "Antwort enthielt keine Mess-Metriken (eval_count/eval_duration).",
      };
    }

    const tokensPerSecond = Math.round((evalCount / (evalDurationNs / 1e9)) * 10) / 10;
    return {
      ok: true,
      model: trimmedModel,
      tokensPerSecond,
      evalCount,
      message: `${tokensPerSecond} Tokens/s über ${evalCount} Tokens.`,
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      model: trimmedModel,
      tokensPerSecond: null,
      evalCount: null,
      message: `Messung fehlgeschlagen: ${raw.slice(0, 160)}`,
    };
  }
}
