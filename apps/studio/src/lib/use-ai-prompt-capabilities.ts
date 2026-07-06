"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import type { AiBrainSettings } from "@uwe/ai-brain";
import {
  buildAiPromptCapabilities,
  resolveContextSelection,
  resolveProviderSelection,
  type AiContextMode,
  type AiPromptCapabilities,
  type AiProviderMode,
} from "./ai-prompt-ui";

interface AdminStatusPayload {
  inference: {
    enabled: boolean;
    online: boolean;
    urlAllowed?: boolean;
    message?: string;
    offlineReason?: string;
  };
  rtx?: {
    ready: boolean;
    online: boolean;
    message: string;
    source: "inference" | "connector";
    agentStatus?: string;
    endpoint?: string;
    connectorReady?: boolean;
    connectorDegraded?: boolean;
    connectorLastError?: string | null;
  };
  brain: {
    enabled: boolean;
    ok: boolean;
  };
}

const DEFAULT_CAPS: AiPromptCapabilities = {
  rtxEnabled: false,
  rtxOnline: false,
  rtxState: "disabled",
  localAiReady: false,
  cloudAvailable: false,
  brainLocal: false,
  hasCurrentObject: false,
};

export interface UseAiPromptCapabilitiesOptions {
  worldSlug?: string;
  pageSlug?: string;
  /** Poll interval in ms; 0 disables polling. Default 15s (matches connector heartbeat). */
  pollIntervalMs?: number;
}

/**
 * Classifies status-load outcomes so the UI can stay calm when AI is simply
 * not available, and only show the hard red error for genuine failures.
 *
 * - "none": status loaded, AI is usable.
 * - "unavailable": AI is intentionally off/offline/mock (RTX disabled, no cloud,
 *   mock mode). Render a muted hint, never a danger block.
 * - "error": unexpected failure (network/5xx while AI is expected). Render red.
 */
export type AiStatusKind = "none" | "unavailable" | "error";

export interface UseAiPromptCapabilitiesResult {
  caps: AiPromptCapabilities;
  loading: boolean;
  /** Legacy generic error message (kept for compatibility). */
  error: string | null;
  /** Classified status outcome. Prefer this over `error` for rendering. */
  statusKind: AiStatusKind;
  /** Calm, muted hint when `statusKind === "unavailable"`. */
  unavailableHint: string | null;
  providerMode: AiProviderMode;
  contextMode: AiContextMode;
  setProviderMode: (mode: AiProviderMode) => void;
  setContextMode: (mode: AiContextMode) => void;
  refresh: () => Promise<void>;
}

const MOCK_AI =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_AI_USE_MOCK === "true";

const HINT_AI_OFFLINE_MOCK =
  "KI läuft im Offline-/Mock-Modus. Antworten sind simuliert.";
const HINT_AI_NOT_AVAILABLE =
  "KI ist aktuell nicht verfügbar (lokale RTX aus, keine Cloud konfiguriert).";

/** True when the resolved capabilities offer no usable AI backend. */
function capsHaveNoBackend(caps: AiPromptCapabilities): boolean {
  return !caps.localAiReady && !caps.cloudAvailable;
}

async function parseStatusJson<T>(response: Response, label: string): Promise<T> {
  if (response.ok || response.status === 503) {
    return (await response.json()) as T;
  }
  throw new Error(`${label} konnte nicht geladen werden.`);
}

function buildInferenceInputFromAdmin(admin: AdminStatusPayload) {
  if (admin.rtx) {
    return {
      enabled: admin.inference?.enabled ?? true,
      online: admin.rtx.ready,
      urlAllowed: true,
      message: admin.rtx.message,
      offlineReason:
        admin.rtx.connectorDegraded && admin.rtx.connectorLastError
          ? admin.rtx.connectorLastError
          : admin.rtx.agentStatus === "error" || admin.rtx.agentStatus === "unreachable"
            ? admin.rtx.message
            : undefined,
      degraded: admin.rtx.connectorDegraded,
    };
  }

  return (
    admin.inference ?? {
      enabled: false,
      online: false,
    }
  );
}

export function useAiPromptCapabilities(
  options: UseAiPromptCapabilitiesOptions = {},
): UseAiPromptCapabilitiesResult {
  const { worldSlug, pageSlug, pollIntervalMs = 15_000 } = options;

  const [caps, setCaps] = useState<AiPromptCapabilities>({
    ...DEFAULT_CAPS,
    hasCurrentObject: Boolean(worldSlug && pageSlug),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<AiStatusKind>("none");
  const [unavailableHint, setUnavailableHint] = useState<string | null>(null);
  const [providerMode, setProviderModeState] = useState<AiProviderMode>(
    pageSlug ? "local_rtx" : "auto",
  );
  const [contextMode, setContextModeState] = useState<AiContextMode>(
    pageSlug ? "current_object" : "general_chat",
  );

  const loadStatus = useCallback(async () => {
    try {
      const [adminRes, settingsRes] = await Promise.all([
        fetch(studioApiUrl("/api/admin/status")),
        fetch(studioApiUrl("/api/ai/settings")),
      ]);

      if (!settingsRes.ok) {
        // In offline/mock mode the status endpoints are expected to be
        // unavailable — keep the panel calm instead of flagging a hard error.
        if (MOCK_AI) {
          setCaps((prev) => ({ ...DEFAULT_CAPS, hasCurrentObject: prev.hasCurrentObject }));
          setError(null);
          setStatusKind("unavailable");
          setUnavailableHint(HINT_AI_OFFLINE_MOCK);
          return;
        }
        throw new Error("Status konnte nicht geladen werden.");
      }

      const admin = await parseStatusJson<AdminStatusPayload>(adminRes, "Admin-Status");
      const settingsData = (await settingsRes.json()) as { settings: AiBrainSettings };
      const settings = settingsData.settings;

      const cloudAvailable =
        !settings.localOnly &&
        settings.providers.some((p) => !p.isLocal && p.enabled && p.hasApiKey);

      const nextCaps = buildAiPromptCapabilities({
        inference: buildInferenceInputFromAdmin(admin),
        cloudAvailable,
        brainLocal: (admin.brain?.enabled ?? false) && (admin.brain?.ok ?? false),
        hasCurrentObject: Boolean(worldSlug && pageSlug),
      });

      setCaps(nextCaps);
      setError(null);

      // Status loaded fine. Distinguish a usable AI from one that is simply
      // switched off/offline — the latter is a calm, muted hint, not an error.
      if (MOCK_AI) {
        setStatusKind("unavailable");
        setUnavailableHint(HINT_AI_OFFLINE_MOCK);
      } else if (capsHaveNoBackend(nextCaps)) {
        setStatusKind("unavailable");
        setUnavailableHint(HINT_AI_NOT_AVAILABLE);
      } else {
        setStatusKind("none");
        setUnavailableHint(null);
      }

      setProviderModeState((current) => {
        const resolvedProvider = resolveProviderSelection(current, nextCaps);
        setContextModeState((ctx) =>
          resolveContextSelection(ctx, resolvedProvider, nextCaps),
        );
        return resolvedProvider;
      });
    } catch {
      // Network/parse failure. Mock/offline dev is expected to fail here, so
      // stay calm; otherwise surface a genuine error.
      if (MOCK_AI) {
        setCaps((prev) => ({ ...DEFAULT_CAPS, hasCurrentObject: prev.hasCurrentObject }));
        setError(null);
        setStatusKind("unavailable");
        setUnavailableHint(HINT_AI_OFFLINE_MOCK);
      } else {
        setError("Status konnte nicht geladen werden.");
        setStatusKind("error");
        setUnavailableHint(null);
      }
    } finally {
      setLoading(false);
    }
  }, [worldSlug, pageSlug]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (pollIntervalMs <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadStatus();
    }, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [loadStatus, pollIntervalMs]);

  function setProviderMode(mode: AiProviderMode) {
    setProviderModeState(mode);
    setContextModeState((current) => resolveContextSelection(current, mode, caps));
    setError(null);
  }

  function setContextMode(mode: AiContextMode) {
    setContextModeState(mode);
    setError(null);
  }

  return {
    caps,
    loading,
    error,
    statusKind,
    unavailableHint,
    providerMode,
    contextMode,
    setProviderMode,
    setContextMode,
    refresh: loadStatus,
  };
}
