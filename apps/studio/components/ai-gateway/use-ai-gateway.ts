"use client";

import { studioApiFetch } from "@/src/lib/studio-api-fetch";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminUserOption, GatewayDashboard, SimulationCase, UsageLogEntry } from "./types";

export function useAiGateway(initialData?: GatewayDashboard | null) {
  const [data, setData] = useState<GatewayDashboard | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [providerForm, setProviderForm] = useState({
    providerId: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    apiKey: "",
  });

  const [grantForm, setGrantForm] = useState({
    userId: "",
    permissions: ["AI_CHAT_USE"] as string[],
    cloudFallbackAllowed: false,
  });

  const [adminUsers, setAdminUsers] = useState<AdminUserOption[]>([]);
  const [usageFilters, setUsageFilters] = useState({
    userId: "",
    feature: "",
    route: "",
    success: "" as "" | "true" | "false",
  });
  const [filteredUsage, setFilteredUsage] = useState<UsageLogEntry[] | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [simulationForm, setSimulationForm] = useState({
    simulateEngineOffline: true,
    privacyFeature: "general_chat",
    userId: "",
  });
  const [simulationCases, setSimulationCases] = useState<SimulationCase[] | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await studioApiFetch("/api/admin/ai-gateway");
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as GatewayDashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Laden fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, []);

  // The page already rendered this payload server-side; only refetch on demand.
  const preloaded = useRef(Boolean(initialData));
  useEffect(() => {
    if (preloaded.current) {
      preloaded.current = false;
      return;
    }
    void load();
  }, [load]);

  const loadAdminUsers = useCallback(async () => {
    try {
      const res = await studioApiFetch("/api/admin/users");
      if (!res.ok) return;
      const body = (await res.json()) as { users?: AdminUserOption[] };
      setAdminUsers(body.users ?? []);
    } catch {
      // User-Picker optional
    }
  }, []);

  const loadFilteredUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const params = new URLSearchParams({ scope: "usage", limit: "100" });
      if (usageFilters.userId) params.set("userId", usageFilters.userId);
      if (usageFilters.feature) params.set("feature", usageFilters.feature);
      if (usageFilters.route) params.set("route", usageFilters.route);
      if (usageFilters.success) params.set("success", usageFilters.success);
      const res = await studioApiFetch(`/api/admin/ai-gateway?${params.toString()}`);
      if (!res.ok) throw new Error("Usage-Logs konnten nicht geladen werden.");
      const body = (await res.json()) as { logs: UsageLogEntry[] };
      setFilteredUsage(body.logs);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Usage-Logs fehlgeschlagen.");
    } finally {
      setUsageLoading(false);
    }
  }, [usageFilters]);

  async function patchConfig(body: Record<string, unknown>) {
    setMessage(null);
    const res = await studioApiFetch("/api/admin/ai-gateway", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      setMessage(err.error ?? "Speichern fehlgeschlagen.");
      return;
    }
    setMessage("Gespeichert.");
    await load();
  }

  async function patchFeatureModel(
    featureKey: string,
    patch: { providerId?: string | null; model?: string | null },
  ) {
    const current = data?.config.featureModels?.[featureKey] ?? {};
    await patchConfig({
      featureModels: {
        [featureKey]: {
          providerId: patch.providerId !== undefined ? patch.providerId : (current.providerId ?? null),
          model: patch.model !== undefined ? patch.model : (current.model ?? null),
        },
      },
    });
  }

  async function deleteGrant(userId: string) {
    setMessage(null);
    const res = await studioApiFetch(`/api/admin/ai-gateway?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      setMessage(err.error ?? "Freigabe löschen fehlgeschlagen.");
      return;
    }
    setMessage("User-Freigabe gelöscht.");
    await load();
  }

  async function saveProvider() {
    setMessage(null);
    const res = await studioApiFetch("/api/admin/ai-gateway?action=provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: providerForm.providerId,
        label: providerForm.label,
        defaultModel: providerForm.defaultModel,
        apiKey: providerForm.apiKey || undefined,
        isEnabled: true,
      }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      setMessage(err.error ?? "Provider speichern fehlgeschlagen.");
      return;
    }
    setProviderForm((prev) => ({ ...prev, apiKey: "" }));
    setMessage("Provider gespeichert (API-Key wird nicht angezeigt).");
    await load();
  }

  async function saveGrant() {
    if (!grantForm.userId.trim()) {
      setMessage("User-ID erforderlich.");
      return;
    }
    setMessage(null);
    const res = await studioApiFetch("/api/admin/ai-gateway?action=user-grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(grantForm),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      setMessage(err.error ?? "Freigabe speichern fehlgeschlagen.");
      return;
    }
    setMessage("User-Freigabe gespeichert.");
    await load();
  }

  async function runFallbackTest() {
    setMessage(null);
    const res = await studioApiFetch("/api/admin/ai-gateway?action=fallback-test", { method: "POST" });
    const body = (await res.json()) as { message?: string; error?: string };
    setMessage(body.message ?? body.error ?? "Test abgeschlossen.");
  }

  async function runRoutingSimulation() {
    setSimulationLoading(true);
    setMessage(null);
    try {
      const res = await studioApiFetch("/api/admin/ai-gateway?action=simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulateEngineOffline: simulationForm.simulateEngineOffline,
          privacyFeature: simulationForm.privacyFeature,
          userId: simulationForm.userId || undefined,
        }),
      });
      const body = (await res.json()) as { cases?: SimulationCase[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Simulation fehlgeschlagen.");
      setSimulationCases(body.cases ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Simulation fehlgeschlagen.");
    } finally {
      setSimulationLoading(false);
    }
  }

  return {
    data, loading, error, message,
    providerForm, setProviderForm,
    grantForm, setGrantForm,
    adminUsers, loadAdminUsers,
    usageFilters, setUsageFilters,
    filteredUsage, usageLoading, loadFilteredUsage,
    simulationForm, setSimulationForm,
    simulationCases, simulationLoading,
    patchConfig, patchFeatureModel, deleteGrant,
    saveProvider, saveGrant, runFallbackTest, runRoutingSimulation,
  };
}
