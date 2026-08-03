import type { CookbookEngineDefinition, CookbookEngineId } from "./types";

export const COOKBOOK_ENGINES: Record<CookbookEngineId, CookbookEngineDefinition> = {
  ollama: {
    id: "ollama",
    label: "Ollama",
    description: "Lokaler Modellserver mit einfachem Pull/Run-Workflow.",
    isLocal: true,
    defaultPort: 11434,
    healthPath: "/api/tags",
    setupHints: [
      "Ollama installieren: https://ollama.com/download",
      "Modell laden: ollama pull llama3.2",
      "In UWE: AI_INFERENCE_PROVIDER=ollama und AI_INFERENCE_BASE_URL=http://localhost:11434",
    ],
  },
  openai_compatible: {
    id: "openai_compatible",
    label: "OpenAI-kompatibel (llama.cpp / vLLM)",
    description: "Lokaler Server mit OpenAI-API (/v1/chat/completions).",
    isLocal: true,
    defaultPort: 8080,
    healthPath: "/v1/models",
    setupHints: [
      "llama-server oder vLLM mit OpenAI-API starten",
      "AI_INFERENCE_PROVIDER=openai_compatible setzen",
      "AI_INFERENCE_BASE_URL auf den lokalen /v1-Endpunkt zeigen lassen",
    ],
  },
  engine_agent: {
    id: "engine_agent",
    label: "UWE Maschinenraum-Agent (Legacy)",
    description:
      "Deprecated inbound GPU-PC-Proxy (ENGINE_AGENT_URL). Standalone-Tool entfernt — bevorzugt outbound Maschinenraum. Brain-Daten bleiben auf dem UWE-Host.",
    isLocal: true,
    defaultPort: 8787,
    healthPath: "/health",
    setupHints: [
      "Deprecated: stattdessen outbound Maschinenraum (tools/uwe-engine-connector) nutzen",
      "Nur Bestands-Setups: ENGINE_AGENT_URL und ENGINE_AGENT_TOKEN in UWE .env setzen",
      "Nur private/heimbüro-IPs — keine öffentlichen URLs",
    ],
  },
  docker_ollama: {
    id: "docker_ollama",
    label: "Docker (Ollama)",
    description: "Ollama in einem Container — gut für Homelab-Setups.",
    isLocal: true,
    defaultPort: 11434,
    healthPath: "/api/tags",
    setupHints: [
      "docker run -d --gpus all -v ollama:/root/.ollama -p 11434:11434 ollama/ollama",
      "AI_INFERENCE_BASE_URL=http://localhost:11434 setzen",
      "GPU-Passthrough erfordert NVIDIA Container Toolkit",
    ],
  },
  lm_studio: {
    id: "lm_studio",
    label: "LM Studio",
    description: "Desktop-UI mit OpenAI-kompatiblem lokalem Server.",
    isLocal: true,
    defaultPort: 1234,
    healthPath: "/v1/models",
    setupHints: [
      "LM Studio: Local Server starten (Standard oft Port 1234)",
      "AI_INFERENCE_PROVIDER=openai_compatible",
      "AI_INFERENCE_BASE_URL=http://localhost:1234/v1",
    ],
  },
};

export function listCookbookEngines(): CookbookEngineDefinition[] {
  return Object.values(COOKBOOK_ENGINES);
}

export function getCookbookEngine(id: CookbookEngineId): CookbookEngineDefinition {
  return COOKBOOK_ENGINES[id];
}
