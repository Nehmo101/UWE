import { z } from "zod";

import { validateHostUrl } from "./validate-host-url";
import {
  CONNECTOR_TRAY_MODES,
  CONNECTOR_TRANSPORT_MODES,
  DEFAULT_SPOTIFY_REDIRECT_URI,
  type ConnectorClientConfig,
  type ConnectorTrayMode,
  type ConnectorTransportMode,
} from "./types";

const DEFAULT_CONNECTOR_NAME = "RTX Host Connector";

const trayModeSchema = z.enum(CONNECTOR_TRAY_MODES);
const transportModeSchema = z.enum(CONNECTOR_TRANSPORT_MODES);

const connectorClientConfigSchema = z.object({
  hostUrl: z.string(),
  token: z.string(),
  name: z.string().trim().min(1, "Name darf nicht leer sein."),
  queueEnabled: z.boolean(),
  transportMode: transportModeSchema,
  wizardCompleted: z.boolean(),
  autoConnect: z.boolean(),
  minimizedStart: z.boolean(),
  autostartWindows: z.boolean(),
  trayMode: trayModeSchema,
  privacyMode: z.boolean(),
  spotifyClientId: z.string(),
  spotifyClientSecret: z.string(),
  spotifyRedirectUri: z.string(),
  audioCommand: z.string(),
  imageCommand: z.string(),
  printCommand: z.string(),
  defaultPrinterId: z.string(),
  localHostRoot: z.string(),
  autoStartHost: z.boolean(),
});

const partialConnectorClientConfigSchema = connectorClientConfigSchema.partial();

export class ConnectorClientConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("\n"));
    this.name = "ConnectorClientConfigError";
    this.issues = issues;
  }
}

/** Default local settings for a fresh connector client install. */
export function defaultConnectorClientConfig(): ConnectorClientConfig {
  return {
    hostUrl: "",
    token: "",
    name: DEFAULT_CONNECTOR_NAME,
    queueEnabled: true,
    transportMode: "queue",
    wizardCompleted: false,
    autoConnect: true,
    minimizedStart: false,
    autostartWindows: false,
    trayMode: "minimize_to_tray",
    privacyMode: false,
    spotifyClientId: "",
    spotifyClientSecret: "",
    spotifyRedirectUri: DEFAULT_SPOTIFY_REDIRECT_URI,
    audioCommand: "",
    imageCommand: "",
    printCommand: "",
    defaultPrinterId: "",
    localHostRoot: "",
    autoStartHost: false,
  };
}

function normalizeTrayMode(value: unknown): ConnectorTrayMode | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = trayModeSchema.safeParse(value.trim());
  return parsed.success ? parsed.data : undefined;
}

function normalizeTransportMode(value: unknown): ConnectorTransportMode | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = transportModeSchema.safeParse(value.trim().toLowerCase());
  return parsed.success ? parsed.data : undefined;
}

function mergeWithDefaults(json: unknown): Record<string, unknown> {
  const defaults = defaultConnectorClientConfig();

  if (json === null || json === undefined) {
    return { ...defaults };
  }

  if (typeof json !== "object" || Array.isArray(json)) {
    throw new ConnectorClientConfigError(["Konfiguration muss ein JSON-Objekt sein."]);
  }

  const input = json as Record<string, unknown>;
  const trayMode = normalizeTrayMode(input.trayMode);

  const normalizedTransportMode = normalizeTransportMode(input.transportMode);
  const transportMode = normalizedTransportMode ?? defaults.transportMode;
  const queueEnabled = normalizedTransportMode
    ? transportMode !== "direct"
    : typeof input.queueEnabled === "boolean"
      ? input.queueEnabled
      : defaults.queueEnabled;
  return {
    hostUrl: typeof input.hostUrl === "string" ? input.hostUrl.trim() : defaults.hostUrl,
    token: typeof input.token === "string" ? input.token.trim() : defaults.token,
    name: typeof input.name === "string" ? input.name.trim() : defaults.name,
    transportMode,
    queueEnabled,
    wizardCompleted:
      typeof input.wizardCompleted === "boolean"
        ? input.wizardCompleted
        : defaults.wizardCompleted,
    autoConnect:
      typeof input.autoConnect === "boolean" ? input.autoConnect : defaults.autoConnect,
    minimizedStart:
      typeof input.minimizedStart === "boolean"
        ? input.minimizedStart
        : defaults.minimizedStart,
    autostartWindows:
      typeof input.autostartWindows === "boolean"
        ? input.autostartWindows
        : defaults.autostartWindows,
    trayMode: trayMode ?? defaults.trayMode,
    privacyMode:
      typeof input.privacyMode === "boolean" ? input.privacyMode : defaults.privacyMode,
    spotifyClientId:
      typeof input.spotifyClientId === "string"
        ? input.spotifyClientId.trim()
        : defaults.spotifyClientId,
    spotifyClientSecret:
      typeof input.spotifyClientSecret === "string"
        ? input.spotifyClientSecret.trim()
        : defaults.spotifyClientSecret,
    spotifyRedirectUri:
      typeof input.spotifyRedirectUri === "string" && input.spotifyRedirectUri.trim()
        ? input.spotifyRedirectUri.trim()
        : defaults.spotifyRedirectUri,
    audioCommand:
      typeof input.audioCommand === "string" ? input.audioCommand.trim() : defaults.audioCommand,
    imageCommand:
      typeof input.imageCommand === "string" ? input.imageCommand.trim() : defaults.imageCommand,
    printCommand:
      typeof input.printCommand === "string" ? input.printCommand.trim() : defaults.printCommand,
    defaultPrinterId:
      typeof input.defaultPrinterId === "string"
        ? input.defaultPrinterId.trim()
        : defaults.defaultPrinterId,
    localHostRoot:
      typeof input.localHostRoot === "string" ? input.localHostRoot.trim() : defaults.localHostRoot,
    autoStartHost:
      typeof input.autoStartHost === "boolean" ? input.autoStartHost : defaults.autoStartHost,
  };
}

/**
 * Parse persisted connector client JSON with validation.
 * Unknown keys are ignored; missing keys receive defaults.
 */
export function parseConnectorClientConfig(json: unknown): ConnectorClientConfig {
  const merged = mergeWithDefaults(json);
  const parsed = partialConnectorClientConfigSchema.safeParse(merged);

  if (!parsed.success) {
    throw new ConnectorClientConfigError(
      parsed.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      }),
    );
  }

  const config = connectorClientConfigSchema.parse({ ...defaultConnectorClientConfig(), ...parsed.data });

  if (config.hostUrl) {
    const hostResult = validateHostUrl(config.hostUrl);
    if (!hostResult.ok) {
      throw new ConnectorClientConfigError([hostResult.reason]);
    }
    config.hostUrl = hostResult.normalized;
    const parsedHost = new URL(config.hostUrl);
    const loopback =
      parsedHost.hostname === "localhost" ||
      parsedHost.hostname === "127.0.0.1" ||
      parsedHost.hostname === "[::1]";
    if (config.transportMode !== "queue" && parsedHost.protocol !== "https:" && !loopback) {
      throw new ConnectorClientConfigError([
        "Direct- und Hybrid-Transport erfordern remote https://; http:// ist nur für localhost, 127.0.0.1 oder [::1] erlaubt.",
      ]);
    }
  }

  return config;
}
