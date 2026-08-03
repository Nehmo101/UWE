/**
 * Shared UI logic for the mobile (and desktop) KI-Prompt panel.
 * Privacy rules mirror the orchestrator spec — server-side guard remains authoritative.
 */

export type AiProviderMode = "auto" | "local_engine" | "cloud";

export type AiContextMode =
  | "general_chat"
  | "brain"
  | "current_object"
  | "current_object_plus_brain"
  | "personal_brain";

export const PROVIDER_LABELS: Record<AiProviderMode, string> = {
  auto: "Auto",
  local_engine: "Lokale KI / Maschinenraum",
  cloud: "Cloud-KI",
};

export const CONTEXT_LABELS: Record<AiContextMode, string> = {
  general_chat: "Allgemeiner Chat",
  brain: "DnD-/World-Wissen",
  current_object: "Aktuelles Objekt",
  current_object_plus_brain: "Aktuelles Objekt + DnD-/World-Wissen",
  personal_brain: "Persönliches Life-Brain",
};

export const HINT_CLOUD_NO_BRAIN =
  "Cloud-KI darf persönliches Life-Brain nicht nutzen.";
export const HINT_ENGINE_NOT_READY = "Der Maschinenraum ist aktuell nicht bereit.";
export const HINT_LOCAL_READY = "Lokale KI bereit.";
export const HINT_ENGINE_DISABLED = "Maschinenraum deaktiviert.";
export const HINT_ENGINE_UNREACHABLE = "Maschinenraum nicht erreichbar.";
export const HINT_LOCAL_NOT_READY =
  "Lokale KI ist aktuell nicht bereit. Bitte Maschinenraum aktivieren oder allgemeinen Cloud-Chat nutzen.";
export const HINT_PERSONAL_BRAIN_LOCAL_ONLY =
  "Persönliches Life-Brain ist nur mit lokaler Maschinenraum verfügbar — kein Cloud-Fallback.";
export const HINT_OBJECT_NEEDS_PAGE =
  "Aktuelles Objekt erfordert eine geöffnete Wiki-Seite.";

export type StatusChipLevel = "ok" | "warn" | "error" | "neutral";

/** Maschinenraum display state shown in status chips (maps inference / future Maschinenraum-agent health). */
export type EngineDisplayState = "online" | "offline" | "disabled" | "starting" | "error";

export interface AiStatusChip {
  id: "engine" | "local_ai" | "cloud" | "brain";
  label: string;
  value: string;
  level: StatusChipLevel;
}

export interface AiPromptCapabilities {
  engineEnabled: boolean;
  engineOnline: boolean;
  /** Fine-grained Maschinenraum state for UI labels (online/offline/deaktiviert/starting/error). */
  engineState: EngineDisplayState;
  localAiReady: boolean;
  cloudAvailable: boolean;
  brainLocal: boolean;
  hasCurrentObject: boolean;
}

export interface ActiveModeSummary {
  providerLabel: string;
  contextLabel: string;
}

const ENGINE_STATE_LABELS: Record<EngineDisplayState, string> = {
  online: "online",
  offline: "offline",
  disabled: "deaktiviert",
  starting: "starting",
  error: "error",
};

const ENGINE_STATE_LEVELS: Record<EngineDisplayState, StatusChipLevel> = {
  online: "ok",
  offline: "error",
  disabled: "neutral",
  starting: "warn",
  error: "error",
};

export interface InferenceStatusInput {
  enabled: boolean;
  online: boolean;
  urlAllowed?: boolean;
  message?: string;
  offlineReason?: string;
  /** Connector heartbeat is fresh but reports lastError — show warn, not full offline. */
  degraded?: boolean;
}

/** Map backend inference (or future Maschinenraum-agent) payload to UI capabilities. */
export function mapInferenceToEngineState(input: InferenceStatusInput): EngineDisplayState {
  if (!input.enabled) {
    return "disabled";
  }
  if (input.urlAllowed === false) {
    return "error";
  }
  if (input.degraded && input.online) {
    return "starting";
  }
  const detail = `${input.message ?? ""} ${input.offlineReason ?? ""}`.toLowerCase();
  if (/starting|wird gestartet|startet/.test(detail)) {
    return "starting";
  }
  if (/error|fehler|blockiert|blocked/.test(detail) && !input.online) {
    return "error";
  }
  if (input.online) {
    return "online";
  }
  return "offline";
}

export function buildAiPromptCapabilities(input: {
  inference: InferenceStatusInput;
  cloudAvailable: boolean;
  brainLocal: boolean;
  hasCurrentObject: boolean;
}): AiPromptCapabilities {
  const engineState = mapInferenceToEngineState(input.inference);
  const engineOnline = engineState === "online";
  const localAiReady = engineState === "online" || engineState === "starting";
  return {
    engineEnabled: input.inference.enabled,
    engineOnline,
    engineState,
    localAiReady,
    cloudAvailable: input.cloudAvailable,
    brainLocal: input.brainLocal,
    hasCurrentObject: input.hasCurrentObject,
  };
}

export function formatActiveModes(
  provider: AiProviderMode,
  context: AiContextMode,
): ActiveModeSummary {
  return {
    providerLabel: PROVIDER_LABELS[provider],
    contextLabel: CONTEXT_LABELS[context],
  };
}

export interface AiPromptUiState {
  hints: string[];
  canSend: boolean;
  sendBlockedReason?: string;
  contextOptions: Array<{
    id: AiContextMode;
    label: string;
    disabled: boolean;
    disabledReason?: string;
  }>;
  providerOptions: Array<{
    id: AiProviderMode;
    label: string;
    disabled: boolean;
    disabledReason?: string;
  }>;
}

const LOCAL_CONTEXT_MODES: AiContextMode[] = ["personal_brain"];

export function requiresLocalContext(mode: AiContextMode): boolean {
  return LOCAL_CONTEXT_MODES.includes(mode);
}

function isPersonalBrainMode(mode: AiContextMode): boolean {
  return mode === "personal_brain";
}

export function deriveStatusChips(caps: AiPromptCapabilities): AiStatusChip[] {
  const engineValue = ENGINE_STATE_LABELS[caps.engineState];
  const engineLevel = ENGINE_STATE_LEVELS[caps.engineState];

  const localValue = caps.localAiReady ? "bereit" : "nicht bereit";
  const localLevel: StatusChipLevel = caps.localAiReady ? "ok" : "warn";

  const cloudValue = caps.cloudAvailable ? "verfügbar" : "nicht konfiguriert";
  const cloudLevel: StatusChipLevel = caps.cloudAvailable ? "ok" : "neutral";

  const brainValue = caps.brainLocal ? "lokal" : "nicht verfügbar";
  const brainLevel: StatusChipLevel = caps.brainLocal ? "ok" : "warn";

  return [
    { id: "engine", label: "Maschinenraum", value: engineValue, level: engineLevel },
    { id: "local_ai", label: "Lokale KI", value: localValue, level: localLevel },
    { id: "cloud", label: "Cloud", value: cloudValue, level: cloudLevel },
    { id: "brain", label: "Brain", value: brainValue, level: brainLevel },
  ];
}

function isContextDisabled(
  mode: AiContextMode,
  provider: AiProviderMode,
  caps: AiPromptCapabilities,
): { disabled: boolean; reason?: string } {
  if (provider === "cloud" && isPersonalBrainMode(mode)) {
    return { disabled: true, reason: HINT_PERSONAL_BRAIN_LOCAL_ONLY };
  }

  if (
    (mode === "current_object" || mode === "current_object_plus_brain") &&
    !caps.hasCurrentObject
  ) {
    return { disabled: true, reason: HINT_OBJECT_NEEDS_PAGE };
  }

  if (isPersonalBrainMode(mode) && !caps.localAiReady) {
    return { disabled: true, reason: HINT_PERSONAL_BRAIN_LOCAL_ONLY };
  }

  if (provider === "local_engine" && !caps.localAiReady && mode !== "general_chat") {
    return { disabled: true, reason: HINT_LOCAL_NOT_READY };
  }

  if (provider === "auto" && mode === "general_chat" && !caps.localAiReady && !caps.cloudAvailable) {
    return { disabled: true, reason: "Weder lokale KI noch Cloud-KI ist verfügbar." };
  }

  return { disabled: false };
}

function isProviderDisabled(
  mode: AiProviderMode,
  caps: AiPromptCapabilities,
): { disabled: boolean; reason?: string } {
  if (mode === "cloud" && !caps.cloudAvailable) {
    return { disabled: true, reason: "Cloud-KI ist nicht konfiguriert." };
  }
  if (mode === "local_engine" && !caps.engineEnabled) {
    return { disabled: true, reason: HINT_ENGINE_DISABLED };
  }
  return { disabled: false };
}

export function computePromptUiState(
  provider: AiProviderMode,
  context: AiContextMode,
  caps: AiPromptCapabilities,
  promptText: string,
): AiPromptUiState {
  const hints: string[] = [];

  if (provider === "cloud" && isPersonalBrainMode(context)) {
    hints.push(HINT_CLOUD_NO_BRAIN);
  }

  if (provider === "auto" && isPersonalBrainMode(context) && !caps.localAiReady) {
    hints.push(HINT_PERSONAL_BRAIN_LOCAL_ONLY);
  }

  if (
    provider === "auto" &&
    !caps.localAiReady &&
    !requiresLocalContext(context) &&
    context !== "general_chat" &&
    caps.cloudAvailable
  ) {
    hints.push("Maschinenraum offline — Cloud-Fallback für DnD-/World-Kontext ist verfügbar.");
  }

  if (provider === "local_engine" && !caps.localAiReady) {
    hints.push(HINT_LOCAL_NOT_READY);
  }

  if (provider === "local_engine" && caps.localAiReady) {
    hints.push(HINT_LOCAL_READY);
  }

  if (caps.engineState === "disabled") {
    hints.push(HINT_ENGINE_DISABLED);
  } else if (caps.engineState === "starting" && provider !== "cloud") {
    hints.push("Maschinenraum wird gestartet — bitte kurz warten.");
  } else if (caps.engineState === "error" && provider !== "cloud") {
    hints.push("Maschinenraum meldet einen Fehler — Systemstatus prüfen.");
  } else if (caps.engineState === "offline" && provider !== "cloud") {
    hints.push(HINT_ENGINE_UNREACHABLE);
  }

  const providerOptions = (Object.keys(PROVIDER_LABELS) as AiProviderMode[]).map((id) => {
    const { disabled, reason } = isProviderDisabled(id, caps);
    return { id, label: PROVIDER_LABELS[id], disabled, disabledReason: reason };
  });

  const contextOptions = (Object.keys(CONTEXT_LABELS) as AiContextMode[]).map((id) => {
    const { disabled, reason } = isContextDisabled(id, provider, caps);
    return { id, label: CONTEXT_LABELS[id], disabled, disabledReason: reason };
  });

  const activeContext = contextOptions.find((o) => o.id === context);
  const contextBlocked = activeContext?.disabled ?? false;

  let canSend = promptText.trim().length > 0 && !contextBlocked;
  let sendBlockedReason: string | undefined;

  if (!promptText.trim()) {
    canSend = false;
    sendBlockedReason = "Bitte eine Nachricht eingeben.";
  } else if (contextBlocked) {
    canSend = false;
    sendBlockedReason = activeContext?.disabledReason;
  } else if (provider === "local_engine" && !caps.localAiReady) {
    canSend = false;
    sendBlockedReason = HINT_LOCAL_NOT_READY;
  } else if (provider === "cloud" && !caps.cloudAvailable) {
    canSend = false;
    sendBlockedReason = "Cloud-KI ist nicht konfiguriert.";
  } else if (provider === "auto" && isPersonalBrainMode(context) && !caps.localAiReady) {
    canSend = false;
    sendBlockedReason = HINT_PERSONAL_BRAIN_LOCAL_ONLY;
  } else if (
    provider === "auto" &&
    context === "general_chat" &&
    !caps.localAiReady &&
    !caps.cloudAvailable
  ) {
    canSend = false;
    sendBlockedReason = "Weder lokale KI noch Cloud-KI ist verfügbar.";
  }

  return {
    hints: [...new Set(hints)],
    canSend,
    sendBlockedReason,
    contextOptions,
    providerOptions,
  };
}

/** Pick a valid context when provider or capabilities change. */
export function resolveContextSelection(
  current: AiContextMode,
  provider: AiProviderMode,
  caps: AiPromptCapabilities,
): AiContextMode {
  const state = computePromptUiState(provider, current, caps, "x");
  const active = state.contextOptions.find((o) => o.id === current);
  if (active && !active.disabled) {
    return current;
  }
  const fallback = state.contextOptions.find((o) => !o.disabled);
  return fallback?.id ?? "general_chat";
}

/** Pick a valid provider when capabilities change. */
export function resolveProviderSelection(
  current: AiProviderMode,
  caps: AiPromptCapabilities,
): AiProviderMode {
  const state = computePromptUiState(current, "general_chat", caps, "x");
  const active = state.providerOptions.find((o) => o.id === current);
  if (active && !active.disabled) {
    return current;
  }
  const fallback = state.providerOptions.find((o) => !o.disabled);
  return fallback?.id ?? "auto";
}

/** Map low-level provider errors to user-facing German hints. */
export function sanitizeAiErrorMessage(message: string): string {
  if (/Ollama chat HTTP 404/i.test(message)) {
    return "Lokales Modell nicht erreichbar — Ollama/LM Studio auf dem Maschinenraum-Rechner starten und das Modell laden.";
  }
  if (/Ollama .+ HTTP/i.test(message)) {
    return "Lokale KI antwortet nicht — Maschinenraum und Ollama auf dem Rechner mit der Hardware prüfen.";
  }
  if (/Kein lokaler LLM-Provider/i.test(message)) {
    return "Maschinenraum meldet keinen lokalen LLM-Provider — Ollama-URL in der Connector-Konfiguration prüfen.";
  }
  return message;
}
