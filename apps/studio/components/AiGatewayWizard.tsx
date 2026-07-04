"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { SECURITY_ROLE_LABELS } from "@uwe/auth";

type RoutingMode = "LOCAL_ONLY" | "LOCAL_THEN_CLOUD" | "CLOUD_ONLY" | "DISABLED";
type PrivacyLevel = "CLOUD_ALLOWED" | "CLOUD_FORBIDDEN" | "LOCAL_REQUIRED";

interface AdminUserOption {
  id: string;
  displayName: string;
  email: string | null;
  role: string;
}

interface UsageLogEntry {
  id: string;
  userDisplayName: string | null;
  feature: string;
  taskType: string | null;
  provider: string;
  model: string;
  route: string;
  success: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  createdAt: string;
}

interface GatewayDashboard {
  config: {
    routingMode: RoutingMode;
    cloudFallbackEnabled: boolean;
    privacyRules: Record<string, PrivacyLevel>;
    featureModels: Record<string, { providerId?: string | null; model?: string | null }>;
    dailyBudgetUsd: number | null;
    monthlyBudgetUsd: number | null;
    perUserDailyBudgetUsd: number | null;
    updatedAt: string;
  };
  providers: Array<{
    id: string;
    providerId: string;
    label: string;
    hasApiKey: boolean;
    isEnabled: boolean;
    defaultModel: string | null;
    priority: number;
  }>;
  budget: {
    dailySpentUsd: number;
    monthlySpentUsd: number;
    userDailySpentUsd: number;
    dailyLimitUsd: number | null;
    monthlyLimitUsd: number | null;
    userDailyLimitUsd: number | null;
    withinBudget: boolean;
  };
  rtxHealth: {
    ready: boolean;
    message?: string;
    source?: "agent" | "inference" | "connector";
    connectorReady?: boolean;
    connectorOnlineCount?: number;
    connectorDegraded?: boolean;
  };
  userGrants: Array<{
    id: string;
    userId: string;
    displayName: string;
    email: string | null;
    permissions: string[];
    cloudFallbackAllowed: boolean;
  }>;
  recentUsage: UsageLogEntry[];
}

const ROUTING_LABELS: Record<RoutingMode, string> = {
  LOCAL_ONLY: "Nur lokal (RTX)",
  LOCAL_THEN_CLOUD: "Lokal, dann Cloud",
  CLOUD_ONLY: "Nur Cloud",
  DISABLED: "Deaktiviert",
};

const PRIVACY_CATEGORY_LABELS: Record<string, string> = {
  general_chat: "Allgemeiner Chat",
  dnd_world: "DnD-Weltwissen (Brain, Objekte)",
  personal_brain: "Persönliches Life-Brain",
  private_notes: "Private Notizen",
  admin_diagnostics: "Admin-Systemdiagnose",
  image_generation: "Bildfunktionen",
};

const FEATURE_MODEL_LABELS: Record<string, string> = {
  general_chat: "Allgemeiner Chat",
  dnd_world: "DnD Generator / Brain / Welt",
  personal_brain: "Life Brain (persönlich)",
  private_notes: "Zusammenfassungen / Notizen",
  admin_diagnostics: "Admin-Diagnose",
  image_generation: "Image Studio",
};

const FEATURE_MODEL_KEYS = Object.keys(FEATURE_MODEL_LABELS);

const WIZARD_STEPS = [
  "RTX verbinden",
  "Routing-Modus",
  "Cloud-Fallback",
  "Provider",
  "Modell pro Feature",
  "Privacy",
  "Budgets",
  "User-Freigaben",
  "Test & Logs",
] as const;

const CLOUD_PROVIDER_PRESETS = [
  { providerId: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini" },
  { providerId: "anthropic", label: "Anthropic", defaultModel: "claude-3-5-haiku-latest" },
  { providerId: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash" },
  { providerId: "openrouter", label: "OpenRouter", defaultModel: "mistralai/mistral-small" },
];

export function AiGatewayWizard() {
  const [data, setData] = useState<GatewayDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
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
    simulateRtxOffline: true,
    privacyFeature: "general_chat",
    userId: "",
  });
  const [simulationCases, setSimulationCases] = useState<
    Array<{ id: string; label: string; passed: boolean; detail: string }> | null
  >(null);
  const [simulationLoading, setSimulationLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(studioApiUrl("/api/admin/ai-gateway"));
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

  useEffect(() => {
    void load();
  }, [load]);

  const loadAdminUsers = useCallback(async () => {
    try {
      const res = await fetch(studioApiUrl("/api/admin/users"));
      if (!res.ok) return;
      const body = (await res.json()) as { users?: AdminUserOption[] };
      setAdminUsers(body.users ?? []);
    } catch {
      // User-Picker optional — manual ID still works
    }
  }, []);

  useEffect(() => {
    if (step === 7 || step === 8) {
      void loadAdminUsers();
    }
  }, [step, loadAdminUsers]);

  const loadFilteredUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const params = new URLSearchParams({ scope: "usage", limit: "100" });
      if (usageFilters.userId) params.set("userId", usageFilters.userId);
      if (usageFilters.feature) params.set("feature", usageFilters.feature);
      if (usageFilters.route) params.set("route", usageFilters.route);
      if (usageFilters.success) params.set("success", usageFilters.success);
      const res = await fetch(studioApiUrl(`/api/admin/ai-gateway?${params.toString()}`));
      if (!res.ok) {
        throw new Error("Usage-Logs konnten nicht geladen werden.");
      }
      const body = (await res.json()) as { logs: UsageLogEntry[] };
      setFilteredUsage(body.logs);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Usage-Logs fehlgeschlagen.");
    } finally {
      setUsageLoading(false);
    }
  }, [usageFilters]);

  useEffect(() => {
    if (step === 8) {
      void loadFilteredUsage();
    }
  }, [step, loadFilteredUsage]);

  async function patchFeatureModel(featureKey: string, patch: { providerId?: string | null; model?: string | null }) {
    const current = data?.config.featureModels?.[featureKey] ?? {};
    await patchConfig({ featureModels: { [featureKey]: { providerId: patch.providerId !== undefined ? patch.providerId : (current.providerId ?? null), model: patch.model !== undefined ? patch.model : (current.model ?? null) } } });
  }

  async function deleteGrant(userId: string) {
    setMessage(null);
    const res = await fetch(studioApiUrl(`/api/admin/ai-gateway?userId=${encodeURIComponent(userId)}`), {
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

  async function patchConfig(body: Record<string, unknown>) {
    setMessage(null);
    const res = await fetch(studioApiUrl("/api/admin/ai-gateway"), {
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

  async function saveProvider() {
    setMessage(null);
    const res = await fetch(studioApiUrl("/api/admin/ai-gateway?action=provider"), {
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
    const res = await fetch(studioApiUrl("/api/admin/ai-gateway?action=user-grant"), {
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
    const res = await fetch(studioApiUrl("/api/admin/ai-gateway?action=fallback-test"), { method: "POST" });
    const body = (await res.json()) as { message?: string; error?: string };
    setMessage(body.message ?? body.error ?? "Test abgeschlossen.");
  }

  async function runRoutingSimulation() {
    setSimulationLoading(true);
    setMessage(null);
    try {
      const res = await fetch(studioApiUrl("/api/admin/ai-gateway?action=simulate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulateRtxOffline: simulationForm.simulateRtxOffline,
          privacyFeature: simulationForm.privacyFeature,
          userId: simulationForm.userId || undefined,
        }),
      });
      const body = (await res.json()) as {
        cases?: Array<{ id: string; label: string; passed: boolean; detail: string }>;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? "Simulation fehlgeschlagen.");
      }
      setSimulationCases(body.cases ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Simulation fehlgeschlagen.");
    } finally {
      setSimulationLoading(false);
    }
  }

  if (loading && !data) {
    return <p className="uwe-muted">KI-Gateway wird geladen…</p>;
  }

  if (error) {
    return (
      <section className="uwe-form-error uwe-v2-section" role="alert">
        {error}
      </section>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="uwe-section-stack">
      <nav className="uwe-inline-nav" aria-label="Setup-Schritte">
        {WIZARD_STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={index === step ? "uwe-button-primary" : "uwe-button-secondary"}
            onClick={() => setStep(index)}
          >
            {index + 1}. {label}
          </button>
        ))}
      </nav>

      {message && (
        <p className="uwe-form-success" role="status">
          {message}
        </p>
      )}

      {step === 0 && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2>RTX verbinden</h2>
          <p>
            Status:{" "}
            <strong>{data.rtxHealth.ready ? "Erreichbar" : "Nicht erreichbar"}</strong>
          </p>
          <p className="uwe-muted">{data.rtxHealth.message}</p>
          {data.rtxHealth.source === "connector" && (
            <p className="uwe-muted">
              Quelle: <strong>RTX Host Connector</strong>
              {typeof data.rtxHealth.connectorOnlineCount === "number"
                ? ` · ${data.rtxHealth.connectorOnlineCount} Connector live`
                : ""}
              {data.rtxHealth.connectorDegraded ? " · meldet Fehler (degraded)" : ""}
            </p>
          )}
          {data.rtxHealth.source === "inference" && (
            <p className="uwe-muted">
              Quelle: <strong>Direkte Inference</strong> (<code>AI_INFERENCE_BASE_URL</code>)
            </p>
          )}
          {!data.rtxHealth.ready && data.rtxHealth.connectorOnlineCount === 0 && (
            <p className="uwe-muted">
              Kein live Connector — unter <a href="/system/rtx-connector">RTX Connector</a> Token
              anlegen und Worker auf dem RTX-PC starten.
            </p>
          )}
          <ul>
            <li>
              Aktiv: outbound <strong>RTX Host Connector</strong> starten
              (<code>pnpm connector:start</code>, <code>tools/uwe-rtx-connector</code>) — verbindet
              sich ausgehend zum Host, kein offener Port am RTX-PC
            </li>
            <li>
              Alternativ direktes Ollama/LM Studio im LAN über <code>AI_INFERENCE_BASE_URL</code>
            </li>
            <li>
              Legacy (deprecated): <code>RTX_AGENT_URL</code> + <code>RTX_AGENT_TOKEN</code> nur für
              Bestands-Setups
            </li>
          </ul>
        </section>
      )}

      {step === 1 && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2>Routing-Modus</h2>
          <p className="uwe-muted">
            Standard: <strong>Lokal, dann Cloud</strong> — RTX wird bevorzugt.
          </p>
          <label className="uwe-field">
            Modus
            <select
              className="uwe-input"
              value={data.config.routingMode}
              onChange={(e) =>
                void patchConfig({ routingMode: e.target.value as RoutingMode })
              }
            >
              {(Object.keys(ROUTING_LABELS) as RoutingMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {ROUTING_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {step === 2 && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2>Cloud-Fallback</h2>
          <label className="uwe-checkbox-row">
            <input
              type="checkbox"
              checked={data.config.cloudFallbackEnabled}
              onChange={(e) => void patchConfig({ cloudFallbackEnabled: e.target.checked })}
            />
            Cloud-Fallback global aktivieren (nur wenn Master-Admin erlaubt)
          </label>
          <p className="uwe-muted">
            Ohne diese Freigabe bleibt UWE bei RTX-Ausfall offline — kein Cloud-Fallback.
          </p>
        </section>
      )}

      {step === 3 && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2>Cloud-Provider</h2>
          <p className="uwe-muted">API-Keys werden verschlüsselt gespeichert — nie im Frontend angezeigt.</p>
          <div className="uwe-form-grid">
            <label className="uwe-field">
              Provider
              <select
                className="uwe-input"
                value={providerForm.providerId}
                onChange={(e) => {
                  const preset = CLOUD_PROVIDER_PRESETS.find((p) => p.providerId === e.target.value);
                  setProviderForm({
                    providerId: e.target.value,
                    label: preset?.label ?? e.target.value,
                    defaultModel: preset?.defaultModel ?? "",
                    apiKey: "",
                  });
                }}
              >
                {CLOUD_PROVIDER_PRESETS.map((p) => (
                  <option key={p.providerId} value={p.providerId}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="uwe-field">
              Standard-Modell
              <input
                className="uwe-input"
                value={providerForm.defaultModel}
                onChange={(e) => setProviderForm((p) => ({ ...p, defaultModel: e.target.value }))}
              />
            </label>
            <label className="uwe-field">
              API-Key (nur beim Setzen/Ersetzen)
              <input
                className="uwe-input"
                type="password"
                autoComplete="off"
                value={providerForm.apiKey}
                onChange={(e) => setProviderForm((p) => ({ ...p, apiKey: e.target.value }))}
              />
            </label>
          </div>
          <button type="button" className="uwe-button-primary" onClick={() => void saveProvider()}>
            Provider speichern
          </button>
          <ul>
            {data.providers.map((p) => (
              <li key={p.id}>
                {p.label} ({p.providerId}) — Key: {p.hasApiKey ? "gesetzt" : "fehlt"} —{" "}
                {p.isEnabled ? "aktiv" : "inaktiv"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === 4 && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2>Modell pro Feature</h2>
          <p className="uwe-muted">
            Optional: Provider und Modell pro Feature überschreiben. Leer = Gateway-Standard.
          </p>
          <table className="uwe-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Provider</th>
                <th>Modell</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_MODEL_KEYS.map((featureKey) => {
                const override = data.config.featureModels?.[featureKey] ?? {};
                const isLocalOnly = featureKey === "personal_brain";
                const selectedProvider = isLocalOnly ? "local_rtx" : (override.providerId ?? "");
                return (
                  <tr key={featureKey}>
                    <td>{FEATURE_MODEL_LABELS[featureKey] ?? featureKey}</td>
                    <td>
                      {isLocalOnly ? (
                        <span className="uwe-muted">RTX (fest)</span>
                      ) : (
                        <select
                          className="uwe-input"
                          value={selectedProvider}
                          onChange={(e) =>
                            void patchFeatureModel(featureKey, {
                              providerId: e.target.value || null,
                            })
                          }
                        >
                          <option value="">— Standard —</option>
                          <option value="local_rtx">RTX (lokal)</option>
                          {data.providers
                            .filter((p) => p.isEnabled)
                            .map((p) => (
                              <option key={p.providerId} value={p.providerId}>
                                {p.label}
                              </option>
                            ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <input
                        className="uwe-input"
                        defaultValue={override.model ?? ""}
                        onBlur={(e) => {
                          const model = e.target.value.trim() || null;
                          if (model !== (override.model ?? null)) {
                            void patchFeatureModel(featureKey, { model });
                          }
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {step === 5 && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2>Privacy-Regeln</h2>
          <p className="uwe-muted">
            Legt fest, welche Inhalte an Cloud-Provider gesendet werden dürfen.
            RTX wird immer bevorzugt — Cloud ist optionaler Fallback.
          </p>
          <p className="uwe-muted">
            <strong>Hinweis:</strong> DnD-Weltwissen darf per Admin-Policy zur Cloud
            (Standard: erlaubt, RTX bevorzugt). Persönliches Life-Brain ist permanent
            lokal-only und nicht konfigurierbar.
          </p>
          {Object.entries(data.config.privacyRules).map(([category, level]) => {
            const isLocked = category === "personal_brain";
            const label = PRIVACY_CATEGORY_LABELS[category] ?? category;
            return (
              <label key={category} className="uwe-field">
                {label}
                {isLocked ? (
                  <span className="uwe-input uwe-input--disabled" aria-disabled="true">
                    Nur lokal — nicht änderbar
                  </span>
                ) : (
                  <select
                    className="uwe-input"
                    value={level}
                    onChange={(e) =>
                      void patchConfig({
                        privacyRules: { [category]: e.target.value as PrivacyLevel },
                      })
                    }
                  >
                    <option value="CLOUD_ALLOWED">Cloud erlaubt (RTX bevorzugt)</option>
                    <option value="CLOUD_FORBIDDEN">Cloud verboten (lokal erzwungen)</option>
                    <option value="LOCAL_REQUIRED">Nur lokal (streng)</option>
                  </select>
                )}
              </label>
            );
          })}
        </section>
      )}

      {step === 6 && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2>Budgets</h2>
          <p>
            Heute: ${data.budget.dailySpentUsd.toFixed(4)} /{" "}
            {data.budget.dailyLimitUsd != null ? `$${data.budget.dailyLimitUsd}` : "∞"}
          </p>
          <p>
            Monat: ${data.budget.monthlySpentUsd.toFixed(4)} /{" "}
            {data.budget.monthlyLimitUsd != null ? `$${data.budget.monthlyLimitUsd}` : "∞"}
          </p>
          <div className="uwe-form-grid">
            <label className="uwe-field">
              Tagesbudget (USD)
              <input
                className="uwe-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="leer = unbegrenzt"
                defaultValue={data.config.dailyBudgetUsd ?? ""}
                onBlur={(e) =>
                  void patchConfig({
                    dailyBudgetUsd: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
            <label className="uwe-field">
              Monatsbudget (USD)
              <input
                className="uwe-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="leer = unbegrenzt"
                defaultValue={data.config.monthlyBudgetUsd ?? ""}
                onBlur={(e) =>
                  void patchConfig({
                    monthlyBudgetUsd: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
          </div>
        </section>
      )}

      {step === 7 && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2>User-Freigaben</h2>
          <p className="uwe-muted">
            Beispiel: Carina für KI-Chat freischalten — ohne Provider- oder Key-Zugriff.
          </p>
          <div className="uwe-form-grid">
            <label className="uwe-field">
              Benutzer
              <select
                className="uwe-input"
                value={grantForm.userId}
                onChange={(e) => setGrantForm((g) => ({ ...g, userId: e.target.value }))}
              >
                <option value="">— Benutzer wählen —</option>
                {adminUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                    {user.email ? ` (${user.email})` : ""} —{" "}
                    {SECURITY_ROLE_LABELS[user.role as keyof typeof SECURITY_ROLE_LABELS] ?? user.role}
                  </option>
                ))}
              </select>
            </label>
            <label className="uwe-checkbox-row">
              <input
                type="checkbox"
                checked={grantForm.cloudFallbackAllowed}
                onChange={(e) =>
                  setGrantForm((g) => ({ ...g, cloudFallbackAllowed: e.target.checked }))
                }
              />
              Cloud-Fallback für diesen User erlauben
            </label>
          </div>
          <fieldset>
            <legend>Features</legend>
            {["AI_CHAT_USE", "AI_DND_USE", "AI_IMAGE_USE", "AI_SUMMARY_USE", "AI_KNOWLEDGE_USE"].map(
              (perm) => (
                <label key={perm} className="uwe-checkbox-row">
                  <input
                    type="checkbox"
                    checked={grantForm.permissions.includes(perm)}
                    onChange={(e) => {
                      setGrantForm((g) => ({
                        ...g,
                        permissions: e.target.checked
                          ? [...g.permissions, perm]
                          : g.permissions.filter((p) => p !== perm),
                      }));
                    }}
                  />
                  {perm}
                </label>
              ),
            )}
          </fieldset>
          <button type="button" className="uwe-button-primary" onClick={() => void saveGrant()}>
            Freigabe speichern
          </button>
          <ul>
            {data.userGrants.map((g) => (
              <li key={g.id}>
                {g.displayName} ({g.email ?? g.userId}) — {g.permissions.join(", ")}
                {g.cloudFallbackAllowed ? " · Cloud-Fallback" : ""}
                {" "}
                <button
                  type="button"
                  className="uwe-button-secondary"
                  onClick={() => void deleteGrant(g.userId)}
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === 8 && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2>Routing-Simulation, Fallback-Test &amp; Usage Logs</h2>

          <div className="uwe-v2-section">
            <h3>Routing-Simulation</h3>
            <p className="uwe-muted">
              Prüft offline, welcher Pfad (RTX vs. Cloud) für die aktuelle Konfiguration greifen würde — ohne echten API-Call.
            </p>
            <div className="uwe-form-grid">
              <label className="uwe-checkbox-row">
                <input
                  type="checkbox"
                  checked={simulationForm.simulateRtxOffline}
                  onChange={(e) =>
                    setSimulationForm((f) => ({ ...f, simulateRtxOffline: e.target.checked }))
                  }
                />
                RTX offline simulieren
              </label>
              <label className="uwe-field">
                Privacy-Feature
                <select
                  className="uwe-input"
                  value={simulationForm.privacyFeature}
                  onChange={(e) =>
                    setSimulationForm((f) => ({ ...f, privacyFeature: e.target.value }))
                  }
                >
                  {Object.keys(data.config.privacyRules).map((feature) => (
                    <option key={feature} value={feature}>
                      {feature}
                    </option>
                  ))}
                </select>
              </label>
              <label className="uwe-field">
                User (Cloud-Fallback-Toggle)
                <select
                  className="uwe-input"
                  value={simulationForm.userId}
                  onChange={(e) =>
                    setSimulationForm((f) => ({ ...f, userId: e.target.value }))
                  }
                >
                  <option value="">— kein User —</option>
                  {adminUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              className="uwe-button-secondary"
              onClick={() => void runRoutingSimulation()}
              disabled={simulationLoading}
            >
              {simulationLoading ? "Simuliere…" : "Routing simulieren"}
            </button>
            {simulationCases && (
              <ul className="uwe-v2-section">
                {simulationCases.map((simCase) => (
                  <li key={simCase.id}>
                    {simCase.passed ? "✓" : "✗"} <strong>{simCase.label}</strong> — {simCase.detail}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="button" className="uwe-button-secondary" onClick={() => void runFallbackTest()}>
            Live-Fallback-Test ausführen
          </button>

          <div className="uwe-form-grid uwe-v2-section">
            <label className="uwe-field">
              User
              <select
                className="uwe-input"
                value={usageFilters.userId}
                onChange={(e) => setUsageFilters((f) => ({ ...f, userId: e.target.value }))}
              >
                <option value="">Alle</option>
                {adminUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="uwe-field">
              Feature
              <input
                className="uwe-input"
                value={usageFilters.feature}
                onChange={(e) => setUsageFilters((f) => ({ ...f, feature: e.target.value }))}
                placeholder="z. B. AI_CHAT_USE"
              />
            </label>
            <label className="uwe-field">
              Route
              <select
                className="uwe-input"
                value={usageFilters.route}
                onChange={(e) => setUsageFilters((f) => ({ ...f, route: e.target.value }))}
              >
                <option value="">Alle</option>
                <option value="local_rtx">local_rtx</option>
                <option value="cloud">cloud</option>
                <option value="web">web</option>
              </select>
            </label>
            <label className="uwe-field">
              Status
              <select
                className="uwe-input"
                value={usageFilters.success}
                onChange={(e) =>
                  setUsageFilters((f) => ({
                    ...f,
                    success: e.target.value as "" | "true" | "false",
                  }))
                }
              >
                <option value="">Alle</option>
                <option value="true">Erfolg</option>
                <option value="false">Fehler</option>
              </select>
            </label>
          </div>
          <div className="uwe-inline-nav">
            <button
              type="button"
              className="uwe-button-secondary"
              onClick={() => void loadFilteredUsage()}
              disabled={usageLoading}
            >
              {usageLoading ? "Laden…" : "Filter anwenden"}
            </button>
            <a
              className="uwe-button-secondary"
              href={`/api/admin/ai-gateway?scope=usage&export=csv&limit=500${
                usageFilters.userId ? `&userId=${encodeURIComponent(usageFilters.userId)}` : ""
              }${usageFilters.feature ? `&feature=${encodeURIComponent(usageFilters.feature)}` : ""}${
                usageFilters.route ? `&route=${encodeURIComponent(usageFilters.route)}` : ""
              }${usageFilters.success ? `&success=${usageFilters.success}` : ""}`}
            >
              CSV exportieren
            </a>
          </div>

          <table className="uwe-table uwe-v2-section">
            <thead>
              <tr>
                <th>Zeit</th>
                <th>User</th>
                <th>Feature</th>
                <th>Route</th>
                <th>Tokens</th>
                <th>Kosten</th>
                <th>OK</th>
              </tr>
            </thead>
            <tbody>
              {(filteredUsage ?? data.recentUsage).map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString("de-DE")}</td>
                  <td>{log.userDisplayName ?? "—"}</td>
                  <td>{log.feature}</td>
                  <td>
                    {log.route} / {log.provider}
                  </td>
                  <td>
                    {log.inputTokens != null || log.outputTokens != null
                      ? `${log.inputTokens ?? 0}+${log.outputTokens ?? 0}`
                      : "—"}
                  </td>
                  <td>{log.estimatedCostUsd != null ? `$${log.estimatedCostUsd.toFixed(4)}` : "—"}</td>
                  <td>{log.success ? "✓" : "✗"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
