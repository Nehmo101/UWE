import type { ConnectorClientConfig, ConnectorConnectionStatus } from "@uwe/connector-client-config";
import type {
  ConnectorRuntimeStatus,
  CookbookDashboardView,
  CookbookFitLevel,
  CookbookModelFit,
  RunnerProbeResult,
} from "./tauri-types";
import { nowTimestamp, readMockConfig, readMockRunning } from "./tauri-mock-storage";

export function deriveConnectionStatus(
  config: ConnectorClientConfig,
  running: boolean,
): ConnectorConnectionStatus {
  if (!config.hostUrl || !config.token) {
    return "not_configured";
  }
  return running ? "connected" : "ready";
}

export function buildMockRuntimeStatus(): ConnectorRuntimeStatus {
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

export function buildMockRunners(): RunnerProbeResult[] {
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

export function buildMockCookbookDashboard(): CookbookDashboardView {
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
      gpus: [],
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
        contextLength: 131072,
        isMoe: false,
        isMultimodal: false,
        tags: ["balanced", "general"],
        useCases: ["dnd_generator", "session_prep"],
        engines: ["ollama", "lm_studio"],
        recommendedQuant: "Q4_K_M",
        minVramGbQ4: 5.5,
        summary: "Solider Allrounder für Generierung und Vorbereitung.",
        strengthTier: 2,
        strengthLabel: "Solide",
        installed: false,
        fit: mockFit("llama3.1:8b", 72, "good"),
      },
    ],
  };
}
