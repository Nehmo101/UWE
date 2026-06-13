import type { AgentConfig } from "./config.js";
import type { BackendManager } from "./backend-manager.js";
import { resolveOllamaModel } from "./ollama.js";
import { isPublicBindHost, resolveAgentUrl } from "./paths.js";
import { touchHealthCheckTimestamp } from "./state.js";
import type { HealthResponse, TrayStatusResponse } from "./types.js";
import { getAutostartStatus } from "./autostart.js";

export async function buildHealthResponse(
  config: AgentConfig,
  backend: BackendManager,
): Promise<HealthResponse> {
  const persisted = touchHealthCheckTimestamp();
  const base: Pick<HealthResponse, "agentUrl" | "ollamaBaseUrl" | "lastHealthCheckAt" | "publicBindWarning"> = {
    agentUrl: resolveAgentUrl(config.host, config.port),
    ollamaBaseUrl: config.ollamaBaseUrl,
    lastHealthCheckAt: persisted.lastHealthCheckAt,
    publicBindWarning: isPublicBindHost(config.host)
      ? "Agent lauscht auf allen Netzwerkschnittstellen. Nur im Heimnetz nutzen."
      : undefined,
  };

  if (!config.enabled) {
    return {
      status: "disabled",
      enabled: false,
      message: "RTX Agent disabled by user",
      ...base,
    };
  }

  const state = await backend.refresh();

  if (state === "starting") {
    return {
      status: "starting",
      enabled: true,
      message: "Local AI backend is starting",
      ...base,
    };
  }

  if (state === "ready") {
    const model = await resolveOllamaModel(
      config.ollamaBaseUrl,
      config.defaultModel,
      Math.min(config.requestTimeoutMs, 5000),
    );
    return {
      status: "ready",
      enabled: true,
      backend: "ollama",
      model,
      gpu: "rtx",
      message: "RTX backend ready",
      ...base,
    };
  }

  return {
    status: "error",
    enabled: true,
    message: "Ollama not reachable",
    ...base,
  };
}

export async function buildTrayStatusResponse(
  config: AgentConfig,
  backend: BackendManager,
): Promise<TrayStatusResponse> {
  const health = await buildHealthResponse(config, backend);
  return {
    ...health,
    autostart: getAutostartStatus().enabled,
    defaultModel: config.defaultModel,
  };
}