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
  spotifyEnabled: boolean;
  imageEnabled: boolean;
  systemInfoEnabled: boolean;
  fileCacheEnabled: boolean;
}

export function resolveCapabilityEnv(env: NodeJS.ProcessEnv = process.env): CapabilityEnv {
  const flag = (value: string | undefined, fallback: boolean) =>
    value == null || value.trim() === "" ? fallback : value.trim().toLowerCase() === "true";
  return {
    audioEnabled: flag(env.UWE_CONNECTOR_AUDIO, true),
    spotifyEnabled: flag(env.UWE_CONNECTOR_SPOTIFY, Boolean(env.SPOTIFY_DEVICE_ID?.trim())),
    imageEnabled: flag(env.UWE_CONNECTOR_IMAGE, false),
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
  if (forced.length > 0) {
    return { capabilities: normalizeCapabilities(forced), models: toModelInfos(llms) };
  }

  const detected: ConnectorCapability[] = [];
  if (env.audioEnabled) detected.push("audio_local");
  if (env.spotifyEnabled) detected.push("spotify_connect");
  if (llms.hasChat) detected.push("llm_local");
  if (llms.hasEmbeddings) detected.push("embedding_local");
  if (env.imageEnabled) detected.push("image_generation");
  if (env.fileCacheEnabled) detected.push("file_cache");
  if (env.systemInfoEnabled) detected.push("system_info");

  return { capabilities: normalizeCapabilities(detected), models: toModelInfos(llms) };
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
