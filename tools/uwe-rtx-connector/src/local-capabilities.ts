/**
 * Decide which capabilities this connector advertises to the host, based on
 * local LLM discovery plus explicit env opt-ins for audio / spotify / images.
 *
 * Detection is conservative: a capability is only reported when the underlying
 * provider is actually reachable or explicitly enabled. The host uses this to
 * decide which queued jobs the connector may claim.
 */

import {
  type ConnectorCapability,
  normalizeCapabilities,
} from "@uwe/connector";

import type { ConnectorModelInfo } from "./host-client";
import type { LocalLlmSummary } from "./llm-discovery";

export interface CapabilityEnv {
  audioEnabled: boolean;
  audioCommandConfigured: boolean;
  spotifyEnabled: boolean;
  spotifyBackendConfigured: boolean;
  imageEnabled: boolean;
  imageExecutorConfigured: boolean;
  systemInfoEnabled: boolean;
  fileCacheEnabled: boolean;
}

export function resolveCapabilityEnv(env: NodeJS.ProcessEnv = process.env): CapabilityEnv {
  const flag = (value: string | undefined, fallback: boolean) =>
    value == null || value.trim() === "" ? fallback : value.trim().toLowerCase() === "true";
  const audioCommandConfigured = Boolean(env.UWE_CONNECTOR_AUDIO_CMD?.trim());
  const spotifyAccessToken = env.UWE_CONNECTOR_SPOTIFY_ACCESS_TOKEN?.trim() || env.SPOTIFY_ACCESS_TOKEN?.trim();
  const spotifyBackendConfigured = Boolean(spotifyAccessToken && env.SPOTIFY_DEVICE_ID?.trim());
  const imageExecutorConfigured = Boolean(env.UWE_CONNECTOR_IMAGE_CMD?.trim());

  return {
    audioCommandConfigured,
    audioEnabled: flag(env.UWE_CONNECTOR_AUDIO, true) && audioCommandConfigured,
    spotifyBackendConfigured,
    spotifyEnabled: flag(env.UWE_CONNECTOR_SPOTIFY, true) && spotifyBackendConfigured,
    imageExecutorConfigured,
    imageEnabled: flag(env.UWE_CONNECTOR_IMAGE, true) && imageExecutorConfigured,
    systemInfoEnabled: flag(env.UWE_CONNECTOR_SYSTEM_INFO, true),
    fileCacheEnabled: flag(env.UWE_CONNECTOR_FILE_CACHE, false),
  };
}

export interface DetectedCapabilities {
  capabilities: ConnectorCapability[];
  models: ConnectorModelInfo[];
}

export function detectCapabilities(
  llms: LocalLlmSummary,
  env: CapabilityEnv,
  forced: readonly ConnectorCapability[] = [],
): DetectedCapabilities {
  const executable = executableCapabilities(llms, env);
  const capabilities =
    forced.length > 0
      ? normalizeCapabilities(forced).filter((capability) => executable.includes(capability))
      : executable;

  return { capabilities, models: toModelInfos(llms) };
}

function executableCapabilities(llms: LocalLlmSummary, env: CapabilityEnv): ConnectorCapability[] {
  const detected: ConnectorCapability[] = [];
  if (env.audioEnabled) detected.push("audio_local");
  if (env.spotifyEnabled) detected.push("spotify_connect");
  if (hasReadyOllamaCapability(llms, "chat")) detected.push("llm_local");
  if (hasReadyOllamaCapability(llms, "embeddings")) detected.push("embedding_local");
  if (env.imageEnabled) detected.push("image_generation");
  if (env.fileCacheEnabled) detected.push("file_cache");
  if (env.systemInfoEnabled) detected.push("system_info");

  return normalizeCapabilities(detected);
}

function hasReadyOllamaCapability(llms: LocalLlmSummary, capability: string): boolean {
  return llms.models.some(
    (model) =>
      model.provider === "ollama" &&
      model.status === "ready" &&
      model.capabilities?.includes(capability),
  );
}

function toModelInfos(llms: LocalLlmSummary): ConnectorModelInfo[] {
  return llms.models.map((model) => ({
    provider: model.provider,
    name: model.name,
    status: model.status,
    contextLength: model.contextLength,
    capabilities: model.capabilities,
  }));
}
