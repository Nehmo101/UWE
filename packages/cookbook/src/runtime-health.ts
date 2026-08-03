import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { listCookbookEngines } from "./engine-registry";
import { diagnoseRuntimeMessages } from "./diagnostics";
import type {
  CookbookRuntimeHealth,
  DockerDiagnostic,
  OllamaDiagnostic,
  RuntimeEngineStatus,
} from "./types";
import type { CookbookRuntimeProbeInput } from "./ai-types";

const execFileAsync = promisify(execFile);

async function probeDocker(): Promise<DockerDiagnostic> {
  try {
    await execFileAsync("docker", ["info"], { timeout: 5000 });
    let ollamaContainerDetected = false;
    try {
      const { stdout } = await execFileAsync(
        "docker",
        ["ps", "--format", "{{.Names}}"],
        { timeout: 5000 },
      );
      ollamaContainerDetected = stdout.toLowerCase().includes("ollama");
    } catch {
      ollamaContainerDetected = false;
    }
    return {
      available: true,
      running: true,
      message: ollamaContainerDetected
        ? "Docker läuft — Ollama-Container erkannt."
        : "Docker läuft — kein Ollama-Container aktiv.",
      ollamaContainerDetected,
    };
  } catch {
    return {
      available: false,
      running: false,
      message: "Docker nicht verfügbar oder nicht gestartet.",
      ollamaContainerDetected: false,
    };
  }
}

async function probeOllamaTags(baseUrl: string, fallbackModels: string[]): Promise<OllamaDiagnostic> {
  const endpoint = baseUrl.replace(/\/$/, "");
  try {
    const response = await fetch(`${endpoint}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return {
        reachable: false,
        endpoint,
        modelCount: 0,
        models: [],
        message: `Ollama antwortet mit HTTP ${response.status}.`,
        urlAllowed: true,
      };
    }
    const payload = (await response.json()) as { models?: Array<{ name?: string }> };
    const models = (payload.models ?? [])
      .map((m) => m.name?.trim())
      .filter((name): name is string => Boolean(name));
    return {
      reachable: true,
      endpoint,
      modelCount: models.length,
      models,
      message:
        models.length > 0
          ? `${models.length} lokale Modelle gefunden.`
          : "Ollama erreichbar, aber keine Modelle geladen.",
      urlAllowed: true,
    };
  } catch {
    return {
      reachable: fallbackModels.length > 0,
      endpoint,
      modelCount: fallbackModels.length,
      models: fallbackModels,
      message:
        fallbackModels.length > 0
          ? "Ollama-Tags nicht abrufbar — Fallback auf Inference-Status."
          : "Ollama nicht erreichbar.",
      urlAllowed: true,
    };
  }
}

function buildEngineStatuses(probe: CookbookRuntimeProbeInput): RuntimeEngineStatus[] {
  const { inference, engineHost } = probe;
  const statuses: RuntimeEngineStatus[] = [];

  for (const engine of listCookbookEngines()) {
    if (engine.id === "engine_agent") {
      statuses.push({
        engineId: engine.id,
        label: engine.label,
        online: engineHost.ready,
        endpoint: engineHost.agentConfigured ? engineHost.endpoint : null,
        modelCount: engineHost.modelCount ?? null,
        defaultModel: engineHost.defaultModel,
        message: engineHost.agentConfigured
          ? engineHost.message
          : "Maschinenraum-Worker nicht konfiguriert (ENGINE_BASE_URL / ENGINE_SERVICE_TOKEN).",
        urlAllowed: engineHost.urlAllowed,
      });
      continue;
    }

    if (engine.id === "ollama" || engine.id === "docker_ollama") {
      const isOllama = inference.providerId === "ollama";
      statuses.push({
        engineId: engine.id,
        label: engine.label,
        online: isOllama && inference.online,
        endpoint: isOllama ? inference.endpoint : null,
        modelCount: isOllama ? (inference.modelCount ?? null) : null,
        defaultModel: isOllama ? inference.defaultModel : null,
        message: isOllama ? inference.message : "Nicht als aktiver Inference-Provider.",
        urlAllowed: inference.urlAllowed,
      });
      continue;
    }

    if (engine.id === "openai_compatible" || engine.id === "lm_studio") {
      const isCompat = inference.providerId === "openai_compatible";
      statuses.push({
        engineId: engine.id,
        label: engine.label,
        online: isCompat && inference.online,
        endpoint: isCompat ? inference.endpoint : null,
        modelCount: isCompat ? (inference.modelCount ?? null) : null,
        defaultModel: isCompat ? inference.defaultModel : null,
        message: isCompat ? inference.message : "Nicht als aktiver Inference-Provider.",
        urlAllowed: inference.urlAllowed,
      });
    }
  }

  return statuses;
}

export async function buildCookbookRuntimeHealth(
  probe: CookbookRuntimeProbeInput,
  options?: { localOnlyMode?: boolean; env?: NodeJS.ProcessEnv },
): Promise<CookbookRuntimeHealth> {
  const env = options?.env ?? process.env;
  const localOnlyMode =
    options?.localOnlyMode ??
    (env.AI_LOCAL_ONLY === "true" || env.AI_DATENSCHUTZ_MODE === "true");

  const fallbackModels =
    probe.inference.online && probe.inference.defaultModel
      ? [probe.inference.defaultModel]
      : [];

  const ollamaBase =
    probe.inference.providerId === "ollama"
      ? probe.inference.endpoint
      : (env.OLLAMA_BASE_URL ?? env.AI_INFERENCE_BASE_URL ?? "http://localhost:11434");

  const [ollama, docker] = await Promise.all([
    probeOllamaTags(ollamaBase, fallbackModels),
    probe.skipDocker ? Promise.resolve({
      available: false,
      running: false,
      message: "Docker-Probe übersprungen.",
      ollamaContainerDetected: false,
    } satisfies DockerDiagnostic) : probeDocker(),
  ]);

  const engines = buildEngineStatuses(probe);
  const warnings: string[] = [];
  const nextSteps: string[] = [];

  if (!probe.inference.urlAllowed || !probe.engineHost.urlAllowed) {
    warnings.push("Inference- oder Maschinenraum-URL ist öffentlich — nur private Adressen für Kampagnendaten.");
    nextSteps.push("AI_INFERENCE_BASE_URL / ENGINE_BASE_URL auf private IP oder localhost setzen.");
  }

  if (localOnlyMode && !probe.engineHost.ready && !probe.inference.online) {
    warnings.push("Local-only aktiv, aber keine lokale Inference bereit — KI-Aufgaben werden zurückgestellt.");
    nextSteps.push("Ollama starten oder Maschinenraum-Agent konfigurieren.");
  }

  if (ollama.reachable && ollama.modelCount === 0) {
    nextSteps.push("Erstes Modell laden: ollama pull llama3.2");
  }

  if (docker.available && !docker.ollamaContainerDetected && probe.inference.providerId === "ollama") {
    nextSteps.push("Optional: Ollama per Docker starten (siehe Cookbook Setup-Hinweise).");
  }

  const diagnoses = diagnoseRuntimeMessages([
    probe.inference.message,
    probe.engineHost.message,
    ollama.message,
    docker.message,
  ]);

  const localReady = probe.engineHost.ready || probe.inference.online;

  return {
    ok: localReady && probe.inference.urlAllowed && probe.engineHost.urlAllowed,
    localOnlyMode,
    engines,
    ollama,
    docker,
    diagnoses,
    warnings,
    nextSteps,
  };
}
