/**
 * Shared UI logic for the mobile (and desktop) KI-Prompt panel.
 * Privacy rules mirror the orchestrator spec — server-side guard remains authoritative.
 */

export type AiProviderMode = "auto" | "local_rtx" | "cloud";

export type AiContextMode =
  | "general_chat"
  | "brain"
  | "current_object"
  | "current_object_plus_brain"
  | "personal_brain";

export const PROVIDER_LABELS: Record<AiProviderMode, string> = {
  auto: "Auto",
  local_rtx: "Lokale KI / RTX",
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
  "Cloud-KI erhält keinen Zugriff auf lokales Brain/Weltwissen.";
export const HINT_BRAIN_LOCAL_ONLY =
  "DnD-/World-Wissen ist nur mit lokaler KI verfügbar.";
export const HINT_RTX_NOT_READY = "Der RTX Connector ist aktuell nicht bereit.";
export const HINT_LOCAL_READY = "Lokale KI bereit.";
export const HINT_RTX_DISABLED = "RTX Connector deaktiviert.";
export const HINT_RTX_UNREACHABLE = "RTX Connector nicht erreichbar.";
export const HINT_LOCAL_NOT_READY =
  "Lokale KI ist aktuell nicht bereit. Bitte RTX Connector aktivieren oder allgemeinen Cloud-Chat nutzen.";
export const HINT_PERSONAL_BRAIN_LOCAL_ONLY =
  "Persönliches Life-Brain ist nur mit lokaler RTX verfügbar — kein Cloud-Fallback.";
export const HINT_OBJECT_NEEDS_PAGE =
  "Aktuelles Objekt erfordert eine geöffnete Wiki-Seite.";

export type StatusChipLevel = "ok" | "warn" | "error" | "neutral";

/** RTX display state shown in status chips (maps inference / future RTX-agent health). */
export type RtxDisplayState = "online" | "offline" | "disabled" | "starting" | "error";

export interface AiStatusChip {
  id: "rtx" | "local_ai" | "cloud" | "brain";
  label: string;
  value: string;
  level: StatusChipLevel;
}

export interface AiPromptCapabilities {
  rtxEnabled: boolean;
  rtxOnline: boolean;
  /** Fine-grained RTX state for UI labels (online/offline/deaktiviert/starting/error). */
  rtxState: RtxDisplayState;
  localAiReady: boolean;
  cloudAvailable: boolean;
  brainLocal: boolean;
  hasCurrentObject: boolean;
}

export interface ActiveModeSummary {
  providerLabel: string;
  contextLabel: string;
}

const RTX_STATE_LABELS: Record<RtxDisplayState, string> = {
  online: "online",
  offline: "offline",
  disabled: "deaktiviert",
  starting: "starting",
  error: "error",
};

const RTX_STATE_LEVELS: Record<RtxDisplayState, StatusChipLevel> = {
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

/** Map backend inference (or future RTX-agent) payload to UI capabilities. */
export function mapInferenceToRtxState(input: InferenceStatusInput): RtxDisplayState {
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
  const rtxState = mapInferenceToRtxState(input.inference);
  const rtxOnline = rtxState === "online";
  const localAiReady = rtxState === "online" || rtxState === "starting";
  return {
    rtxEnabled: input.inference.enabled,
    rtxOnline,
    rtxState,
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

const LOCAL_CONTEXT_MODES: AiContextMode[] = [
  "brain",
  "current_object",
  "current_object_plus_brain",
  "personal_brain",
];

export function requiresLocalContext(mode: AiContextMode): boolean {
  return LOCAL_CONTEXT_MODES.includes(mode);
}

export function deriveStatusChips(caps: AiPromptCapabilities): AiStatusChip[] {
  const rtxValue = RTX_STATE_LABELS[caps.rtxState];
  const rtxLevel = RTX_STATE_LEVELS[caps.rtxState];

  const localValue = caps.localAiReady ? "bereit" : "nicht bereit";
  const localLevel: StatusChipLevel = caps.localAiReady ? "ok" : "warn";

  const cloudValue = caps.cloudAvailable ? "verfügbar" : "nicht konfiguriert";
  const cloudLevel: StatusChipLevel = caps.cloudAvailable ? "ok" : "neutral";

  const brainValue = caps.brainLocal ? "lokal" : "nicht verfügbar";
  const brainLevel: StatusChipLevel = caps.brainLocal ? "ok" : "warn";

  return [
    { id: "rtx", label: "RTX", value: rtxValue, level: rtxLevel },
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
  if (provider === "cloud" && requiresLocalContext(mode)) {
    return { disabled: true, reason: HINT_CLOUD_NO_BRAIN };
  }

  if (
    (mode === "current_object" || mode === "current_object_plus_brain") &&
    !caps.hasCurrentObject
  ) {
    return { disabled: true, reason: HINT_OBJECT_NEEDS_PAGE };
  }

  if (requiresLocalContext(mode) && !caps.localAiReady) {
    if (provider === "auto" && caps.cloudAvailable && mode !== "general_chat") {
      return {
        disabled: true,
        reason: mode === "personal_brain" ? HINT_PERSONAL_BRAIN_LOCAL_ONLY : HINT_BRAIN_LOCAL_ONLY,
      };
    }
    if (provider === "auto") {
      return {
        disabled: true,
        reason: mode === "personal_brain" ? HINT_PERSONAL_BRAIN_LOCAL_ONLY : HINT_BRAIN_LOCAL_ONLY,
      };
    }
    return { disabled: true, reason: HINT_LOCAL_NOT_READY };
  }

  if (requiresLocalContext(mode) && !caps.brainLocal && mode === "brain") {
    return { disabled: true, reason: "Brain ist lokal nicht verfügbar." };
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
  if (mode === "local_rtx" && !caps.rtxEnabled) {
    return { disabled: true, reason: HINT_RTX_DISABLED };
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

  if (provider === "cloud") {
    hints.push(HINT_CLOUD_NO_BRAIN);
  }

  if (provider === "auto" && !caps.localAiReady && requiresLocalContext(context)) {
    hints.push(HINT_BRAIN_LOCAL_ONLY);
  }

  if (provider === "local_rtx" && !caps.localAiReady) {
    hints.push(HINT_LOCAL_NOT_READY);
  }

  if (provider === "local_rtx" && caps.localAiReady) {
    hints.push(HINT_LOCAL_READY);
  }

  if (caps.rtxState === "disabled") {
    hints.push(HINT_RTX_DISABLED);
  } else if (caps.rtxState === "starting" && provider !== "cloud") {
    hints.push("RTX Connector wird gestartet — bitte kurz warten.");
  } else if (caps.rtxState === "error" && provider !== "cloud") {
    hints.push("RTX Connector meldet einen Fehler — Systemstatus prüfen.");
  } else if (caps.rtxState === "offline" && provider !== "cloud") {
    hints.push(HINT_RTX_UNREACHABLE);
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
  } else if (provider === "local_rtx" && !caps.localAiReady) {
    canSend = false;
    sendBlockedReason = HINT_LOCAL_NOT_READY;
  } else if (provider === "cloud" && !caps.cloudAvailable) {
    canSend = false;
    sendBlockedReason = "Cloud-KI ist nicht konfiguriert.";
  } else if (provider === "auto" && requiresLocalContext(context) && !caps.localAiReady) {
    canSend = false;
    sendBlockedReason = HINT_BRAIN_LOCAL_ONLY;
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
    return "Lokales Modell nicht erreichbar — Ollama/LM Studio auf dem RTX-Rechner starten und das Modell laden.";
  }
  if (/Ollama .+ HTTP/i.test(message)) {
    return "Lokale KI (RTX) antwortet nicht — RTX Connector und Ollama auf dem RTX-Rechner prüfen.";
  }
  if (/Kein lokaler LLM-Provider/i.test(message)) {
    return "RTX Connector meldet keinen lokalen LLM-Provider — Ollama-URL in der Connector-Konfiguration prüfen.";
  }
  return message;
}
