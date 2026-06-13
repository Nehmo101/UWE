"use client";

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
    source: "agent" | "inference";
    agentStatus?: string;
    endpoint?: string;
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
  /** Poll interval in ms; 0 disables polling. Default 30s. */
  pollIntervalMs?: number;
}

export interface UseAiPromptCapabilitiesResult {
  caps: AiPromptCapabilities;
  loading: boolean;
  error: string | null;
  providerMode: AiProviderMode;
  contextMode: AiContextMode;
  setProviderMode: (mode: AiProviderMode) => void;
  setContextMode: (mode: AiContextMode) => void;
  refresh: () => Promise<void>;
}

export function useAiPromptCapabilities(
  options: UseAiPromptCapabilitiesOptions = {},
): UseAiPromptCapabilitiesResult {
  const { worldSlug, pageSlug, pollIntervalMs = 30_000 } = options;

  const [caps, setCaps] = useState<AiPromptCapabilities>({
    ...DEFAULT_CAPS,
    hasCurrentObject: Boolean(worldSlug && pageSlug),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerMode, setProviderModeState] = useState<AiProviderMode>("auto");
  const [contextMode, setContextModeState] = useState<AiContextMode>("general_chat");

  const loadStatus = useCallback(async () => {
    try {
      const [adminRes, settingsRes] = await Promise.all([
        fetch("/api/admin/status"),
        fetch("/api/ai/settings"),
      ]);

      if (!adminRes.ok || !settingsRes.ok) {
        throw new Error("Status konnte nicht geladen werden.");
      }

      const admin = (await adminRes.json()) as AdminStatusPayload;
      const settingsData = (await settingsRes.json()) as { settings: AiBrainSettings };
      const settings = settingsData.settings;

      const cloudAvailable =
        !settings.localOnly &&
        settings.providers.some((p) => !p.isLocal && p.enabled && p.hasApiKey);

      const inferenceInput = admin.rtx
        ? {
            enabled: admin.inference?.enabled ?? true,
            online: admin.rtx.online,
            urlAllowed: true,
            message: admin.rtx.message,
            offlineReason:
              admin.rtx.agentStatus === "error" || admin.rtx.agentStatus === "unreachable"
                ? admin.rtx.message
                : undefined,
          }
        : admin.inference ?? { enabled: false, online: false };

      const nextCaps = buildAiPromptCapabilities({
        inference: inferenceInput,
        cloudAvailable,
        brainLocal: (admin.brain?.enabled ?? false) && (admin.brain?.ok ?? false),
        hasCurrentObject: Boolean(worldSlug && pageSlug),
      });

      setCaps(nextCaps);
      setError(null);

      setProviderModeState((current) => {
        const resolvedProvider = resolveProviderSelection(current, nextCaps);
        setContextModeState((ctx) =>
          resolveContextSelection(ctx, resolvedProvider, nextCaps),
        );
        return resolvedProvider;
      });
    } catch {
      setError("Status konnte nicht geladen werden.");
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
    providerMode,
    contextMode,
    setProviderMode,
    setContextMode,
    refresh: loadStatus,
  };
}
