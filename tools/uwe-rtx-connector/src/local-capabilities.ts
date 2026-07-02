/**
 * Decide which capabilities and models this connector advertises to the host.
 *
 * Two filters apply:
 *   • Capabilities are conservative — only reported when the underlying backend
 *     is actually reachable or explicitly configured (audio/spotify/image), and
 *     `llm_local` / `embedding_local` only when an *enabled* Ollama model of the
 *     right kind is discovered ready.
 *   • Models sent on heartbeat are ONLY the profiles the user enabled for UWE
 *     (`enabledForUwe`), enriched with live discovery metadata (status, context
 *     length, capabilities) when a matching local model is found.
 *   • Privacy mode (`UWE_CONNECTOR_PRIVACY_MODE=true`) additionally strips the
 *     heartbeat down to what the host needs for job routing: model id/provider/
 *     name plus chat/embeddings capabilities, printer id/name. Display metadata
 *     (descriptions, bestFor, context length, live status) stays local. WHICH
 *     capabilities are advertised never changes — only the metadata richness.
 *
 * No world/brain/personal data is involved — only model descriptors.
 */

import {
  normalizeCapabilities,
  type ConnectorCapability,
  type ConnectorModelInfo,
  type LocalPrinterInfo,
} from "@uwe/connector";
import {
  modelProfileKey,
  type ConnectorModelProfile,
} from "@uwe/connector-model-profile";

import type { DiscoveredModel, LocalLlmSummary } from "./llm-discovery";
import { discoverLocalPrinters } from "./label-printing";

export interface CapabilityEnv {
  audioEnabled: boolean;
  audioCommandConfigured: boolean;
  spotifyEnabled: boolean;
  spotifyBackendConfigured: boolean;
  imageEnabled: boolean;
  imageExecutorConfigured: boolean;
  systemInfoEnabled: boolean;
  fileCacheEnabled: boolean;
  printEnabled: boolean;
  printBackendConfigured: boolean;
  /** Report only routing-minimal metadata on heartbeat (no display/telemetry fields). */
  privacyModeEnabled: boolean;
}

export function resolveCapabilityEnv(env: NodeJS.ProcessEnv = process.env): CapabilityEnv {
  const flag = (value: string | undefined, fallback: boolean) =>
    value == null || value.trim() === "" ? fallback : value.trim().toLowerCase() === "true";
  const audioCommandConfigured = Boolean(env.UWE_CONNECTOR_AUDIO_CMD?.trim());
  const spotifyAccessToken = env.UWE_CONNECTOR_SPOTIFY_ACCESS_TOKEN?.trim() || env.SPOTIFY_ACCESS_TOKEN?.trim();
  const spotifyBackendConfigured = Boolean(spotifyAccessToken && env.SPOTIFY_DEVICE_ID?.trim());
  const imageExecutorConfigured = Boolean(env.UWE_CONNECTOR_IMAGE_CMD?.trim());
  const printCommandConfigured = Boolean(env.UWE_CONNECTOR_PRINT_CMD?.trim());
  const printPrintersConfigured = Boolean(env.UWE_CONNECTOR_PRINTERS?.trim());

  return {
    audioCommandConfigured,
    audioEnabled: flag(env.UWE_CONNECTOR_AUDIO, true) && audioCommandConfigured,
    spotifyBackendConfigured,
    spotifyEnabled: flag(env.UWE_CONNECTOR_SPOTIFY, true) && spotifyBackendConfigured,
    imageExecutorConfigured,
    imageEnabled: flag(env.UWE_CONNECTOR_IMAGE, true) && imageExecutorConfigured,
    systemInfoEnabled: flag(env.UWE_CONNECTOR_SYSTEM_INFO, true),
    fileCacheEnabled: flag(env.UWE_CONNECTOR_FILE_CACHE, false),
    printBackendConfigured: printCommandConfigured || printPrintersConfigured,
    printEnabled: flag(env.UWE_CONNECTOR_PRINT, true) && (printCommandConfigured || printPrintersConfigured),
    privacyModeEnabled: flag(env.UWE_CONNECTOR_PRIVACY_MODE, false),
  };
}

export interface DetectedCapabilities {
  capabilities: ConnectorCapability[];
  models: ConnectorModelInfo[];
  printers: LocalPrinterInfo[];
}

export interface DetectCapabilitiesOptions {
  /** User-curated model profiles. Only `enabledForUwe` profiles are advertised. */
  profiles?: readonly ConnectorModelProfile[];
  /** Capability requests from env; still filtered against executable backends. */
  forced?: readonly ConnectorCapability[];
}

function discoveredKey(model: DiscoveredModel): string {
  return modelProfileKey(model.provider, model.name, model.path ?? null);
}

export function detectCapabilities(
  llms: LocalLlmSummary,
  env: CapabilityEnv,
  options: DetectCapabilitiesOptions = {},
): DetectedCapabilities {
  const profiles = options.profiles ?? [];
  const enabledKeys = new Set(
    profiles.filter((profile) => profile.enabledForUwe).map((profile) => profile.id),
  );

  const executable = executableCapabilities(llms, env, enabledKeys);
  const forced = options.forced ?? [];
  const capabilities =
    forced.length > 0
      ? normalizeCapabilities(forced).filter((capability) => executable.includes(capability))
      : executable;

  return {
    capabilities,
    models: toEnabledModelInfos(llms, profiles, env.privacyModeEnabled),
    printers: sanitizePrintersForPrivacy(discoverLocalPrinters(), env.privacyModeEnabled),
  };
}

function executableCapabilities(
  llms: LocalLlmSummary,
  env: CapabilityEnv,
  enabledKeys: ReadonlySet<string>,
): ConnectorCapability[] {
  const detected: ConnectorCapability[] = [];
  if (env.audioEnabled) detected.push("audio_local");
  if (env.spotifyEnabled) detected.push("spotify_connect");
  if (hasEnabledOllamaCapability(llms, enabledKeys, "chat")) detected.push("llm_local");
  if (hasEnabledOllamaCapability(llms, enabledKeys, "embeddings")) detected.push("embedding_local");
  if (env.imageEnabled) detected.push("image_generation");
  if (env.fileCacheEnabled) detected.push("file_cache");
  if (env.printEnabled) detected.push("label_printing");
  if (env.systemInfoEnabled) detected.push("system_info");

  return normalizeCapabilities(detected);
}

/**
 * A local LLM capability is only advertised when there is a ready Ollama model
 * of the right kind that the user has explicitly enabled for UWE.
 */
function hasEnabledOllamaCapability(
  llms: LocalLlmSummary,
  enabledKeys: ReadonlySet<string>,
  capability: string,
): boolean {
  return llms.models.some(
    (model) =>
      model.provider === "ollama" &&
      model.status === "ready" &&
      model.capabilities?.includes(capability) &&
      enabledKeys.has(discoveredKey(model)),
  );
}

/**
 * Build the heartbeat model list: exactly the enabled profiles, each enriched
 * with live discovery metadata when a matching local model is found.
 *
 * In privacy mode only the routing essentials leave the machine: id, provider,
 * name and the discovered chat/embeddings capabilities (the host queue needs
 * those to match jobs). Display metadata, context length and live status stay
 * local.
 */
function toEnabledModelInfos(
  llms: LocalLlmSummary,
  profiles: readonly ConnectorModelProfile[],
  privacyMode: boolean,
): ConnectorModelInfo[] {
  const discoveredByKey = new Map<string, DiscoveredModel>();
  for (const model of llms.models) {
    discoveredByKey.set(discoveredKey(model), model);
  }

  return profiles
    .filter((profile) => profile.enabledForUwe)
    .map((profile) => {
      const discovered = discoveredByKey.get(profile.id);
      const info: ConnectorModelInfo = {
        id: profile.id,
        provider: profile.provider,
        name: profile.name,
        enabledForUwe: true,
      };
      if (discovered?.capabilities?.length) info.capabilities = discovered.capabilities;
      if (privacyMode) {
        return info;
      }
      info.modelType = profile.modelType;
      if (discovered?.status) info.status = discovered.status;
      const contextLength = discovered?.contextLength ?? profile.contextLength ?? undefined;
      if (contextLength != null) info.contextLength = contextLength;
      if (profile.displayName) info.displayName = profile.displayName;
      if (profile.description) info.description = profile.description;
      if (profile.bestFor.length > 0) info.bestFor = profile.bestFor;
      return info;
    });
}

/**
 * Reduce printers to routing essentials in privacy mode: the host only needs
 * id + name (and the default flag) to offer a print target — CUPS descriptions
 * and live printer state are host-facing telemetry and stay local.
 */
export function sanitizePrintersForPrivacy(
  printers: readonly LocalPrinterInfo[],
  privacyMode: boolean,
): LocalPrinterInfo[] {
  if (!privacyMode) {
    return [...printers];
  }
  return printers.map((printer) => {
    const minimal: LocalPrinterInfo = { id: printer.id, name: printer.name };
    if (printer.isDefault != null) minimal.isDefault = printer.isDefault;
    return minimal;
  });
}
