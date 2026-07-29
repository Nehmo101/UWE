"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { studioApiFetch } from "@/src/lib/studio-api-fetch";
import { EmptyState, LoadingState } from "@uwe/shared-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { waitForJob } from "@/src/lib/poll-job";
import { formatStudioDate } from "@/src/lib/format";
import { useAiPromptCapabilities } from "@/src/lib/use-ai-prompt-capabilities";
import { HINT_LOCAL_NOT_READY } from "@/src/lib/ai-prompt-ui";
import type { AiBrainSettings, AiContext, AiProviderId, DndGeneratorAction } from "@uwe/ai-brain";
import type { BrainActionDefinition, BrainActionId } from "@uwe/ai-brain";
import {
  ConnectorModelPicker,
  type ConnectorModelSelection,
  type ConnectorPickerModelView,
} from "@/components/ConnectorModelPicker";

interface Props {
  worldSlug: string;
  pageSlug?: string;
  sessionId?: string;
  defaultSessionId?: string;
  defaultActionId?: BrainActionId;
  generatorActions?: DndGeneratorAction[];
  /** Sidebar = wiki context panel; store = Brain Knowledge Store page. */
  variant?: "sidebar" | "store";
}

interface SessionOption {
  id: string;
  title: string;
  sessionNumber: number;
}

interface AiProposalView {
  id: string;
  label: string;
  content: string;
  targetType: string;
  status: string;
  metadata?: { subject?: string; mailDraft?: boolean };
}

interface AiRunView {
  id: string;
  status: string;
  taskType: string;
  resultText: string | null;
  proposals: AiProposalView[] | null;
  createdAt: string;
}

export function AiBrainSidebar({
  worldSlug,
  pageSlug,
  sessionId: fixedSessionId,
  defaultSessionId,
  defaultActionId = "expand_knowledge",
  generatorActions,
  variant = "sidebar",
}: Props) {
  const isStoreVariant = variant === "store";
  const {
    caps,
    loading: statusLoading,
    statusKind,
    unavailableHint,
  } = useAiPromptCapabilities({
    worldSlug,
    pageSlug,
    pollIntervalMs: isStoreVariant ? 15_000 : 0,
  });
  const [settings, setSettings] = useState<AiBrainSettings | null>(null);
  const [actions, setActions] = useState<BrainActionDefinition[]>([]);
  const [actionId, setActionId] = useState<BrainActionId>(defaultActionId);
  const [providerId, setProviderId] = useState<AiProviderId>("ollama");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [context, setContext] = useState<AiContext | null>(null);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [run, setRun] = useState<AiRunView | null>(null);
  const [proposals, setProposals] = useState<AiProposalView[]>([]);
  const [editedContents, setEditedContents] = useState<Record<string, string>>({});
  const [recentRuns, setRecentRuns] = useState<AiRunView[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [allowDmOnly, setAllowDmOnly] = useState(false);
  const [connectorModels, setConnectorModels] = useState<ConnectorPickerModelView[]>([]);
  const [connectorSelection, setConnectorSelection] = useState<ConnectorModelSelection | null>(null);

  const showLegacyProviderControls = !isStoreVariant;
  const showConnectorPicker = connectorModels.length > 0;
  const showLocalModelPicker = !showConnectorPicker || !isStoreVariant;
  const rtxReady = caps.localAiReady || process.env.NEXT_PUBLIC_AI_USE_MOCK === "true";
  const canRunAction =
    !loading &&
    Boolean(model) &&
    (!isStoreVariant || rtxReady || process.env.NEXT_PUBLIC_AI_USE_MOCK === "true");

  const selectedAction = useMemo(
    () => actions.find((action) => action.id === actionId),
    [actions, actionId],
  );

  const needsSession = selectedAction?.requiresSession ?? false;
  const isPlayerSafe = selectedAction?.playerSafe ?? false;

  const availableProviders = useMemo(() => {
    if (!settings) return [];
    return settings.providers.filter((provider) => {
      if (settings.localOnly) return provider.isLocal;
      return provider.enabled || provider.isLocal;
    });
  }, [settings]);

  const loadSettings = useCallback(async () => {
    const response = await studioApiFetch("/api/ai/settings");
    // An error body has no `settings`, so reading it threw an unhandled rejection
    // inside this callback and left the sidebar unusable on every wiki page.
    if (!response.ok) return;
    const data = (await response.json()) as { settings: AiBrainSettings };
    setSettings(data.settings);
    setAllowDmOnly(data.settings.localOnly);
    const initialProvider =
      data.settings.providers.find((p) => p.id === data.settings.defaultProvider) ??
      data.settings.providers.find((p) => p.isLocal);
    if (initialProvider) {
      setProviderId(initialProvider.id);
    }
  }, []);

  const loadActions = useCallback(async () => {
    const response = await studioApiFetch("/api/brain/actions");
    if (!response.ok) return;
    const data = (await response.json()) as { actions: BrainActionDefinition[] };
    setActions(data.actions);
    if (data.actions.length > 0) {
      const preferred = data.actions.find((action) => action.id === defaultActionId);
      setActionId(preferred?.id ?? data.actions[0].id);
    }
  }, [defaultActionId]);

  const loadSessions = useCallback(async () => {
    if (fixedSessionId) {
      setSessionId(fixedSessionId);
      return;
    }
    if (!pageSlug) return;

    const response = await fetch(
      studioApiUrl(
        `/api/ai/sessions?worldSlug=${encodeURIComponent(worldSlug)}&pageSlug=${encodeURIComponent(pageSlug)}`,
      ),
    );
    if (!response.ok) return;
    const data = (await response.json()) as { sessions: SessionOption[] };
    setSessions(data.sessions);
    if (data.sessions.length > 0) {
      setSessionId((prev) => prev || defaultSessionId || data.sessions[0].id);
    }
  }, [worldSlug, pageSlug, fixedSessionId, defaultSessionId]);

  const loadRecentRuns = useCallback(async () => {
    const params = new URLSearchParams({
      worldSlug,
      limit: "5",
    });
    if (pageSlug) params.set("pageSlug", pageSlug);

    const response = await studioApiFetch(`/api/brain/runs?${params.toString()}`);
    if (!response.ok) return;
    const data = (await response.json()) as { runs: AiRunView[] };
    setRecentRuns(data.runs);
  }, [worldSlug, pageSlug]);

  const loadModels = useCallback(async (selectedProvider: AiProviderId) => {
    const useMock = process.env.NEXT_PUBLIC_AI_USE_MOCK === "true";
    const response = await fetch(
      studioApiUrl(
        `/api/ai/models?provider=${selectedProvider}${useMock ? "&mock=true" : ""}`,
      ),
    );
    if (!response.ok) {
      setModels([{ id: "mock-model", name: "Mock Model (offline)" }]);
      setModel("mock-model");
      return;
    }
    const data = (await response.json()) as {
      models: Array<{ id: string; name: string }>;
      health?: { ok: boolean; message: string };
    };
    setModels(data.models);
    setModel(data.models[0]?.id ?? "");
    if (data.health && !data.health.ok) {
      setStatus(`Provider-Hinweis: ${data.health.message}`);
    }
  }, []);

  const loadConnectorModels = useCallback(async () => {
    try {
      const response = await studioApiFetch("/api/admin/connector-workflow", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        setConnectorModels([]);
        return;
      }
      const data = (await response.json()) as { pickerModels?: ConnectorPickerModelView[] };
      setConnectorModels(data.pickerModels ?? []);
    } catch {
      setConnectorModels([]);
    }
  }, []);

  const handleConnectorSelection = useCallback(
    (selection: ConnectorModelSelection | null) => {
      setConnectorSelection(selection);
      if (!selection) {
        return;
      }
      const picked = connectorModels.find(
        (entry) => entry.connectorId === selection.connectorId && entry.modelId === selection.modelId,
      );
      if (!picked) {
        return;
      }
      const matchingProvider = availableProviders.find((provider) => provider.id === picked.provider);
      if (matchingProvider) {
        setProviderId(matchingProvider.id);
      }
      setModel(picked.name);
      setStatus(
        `Connector-Modell „${picked.displayName?.trim() || picked.name}" gewählt (${picked.connectorName}). Ausführung läuft über die Maschinenraum-Queue.`,
      );
    },
    [connectorModels, availableProviders],
  );

  useEffect(() => {
    void loadSettings();
    void loadActions();
    void loadSessions();
    void loadRecentRuns();
    void loadConnectorModels();
  }, [loadSettings, loadActions, loadSessions, loadRecentRuns, loadConnectorModels]);

  useEffect(() => {
    if (providerId) {
      void loadModels(providerId);
    }
  }, [providerId, loadModels]);

  async function handleRunAction() {
    if (run?.status === "completed") {
      await handleDiscard();
    }

    setLoading(true);
    setStatus(null);
    setRun(null);
    setProposals([]);
    setContext(null);

    try {
      const useMock =
        process.env.NEXT_PUBLIC_AI_USE_MOCK === "true" || model === "mock-model";
      const response = await studioApiFetch("/api/brain/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId,
          worldSlug,
          pageSlug: pageSlug || undefined,
          providerId,
          model,
          userPrompt,
          sessionId: needsSession
            ? fixedSessionId || sessionId || undefined
            : fixedSessionId || undefined,
          useMock,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Brain-Aktion fehlgeschlagen");
      }

      let payload = data;
      if (response.status === 202 && data.job?.id) {
        if (data.job.status === "deferred") {
          setStatus(
            "RTX offline — KI-Job vorgemerkt (deferred). Ausführung startet automatisch, wenn RTX bereit ist. Kein Cloud-Fallback.",
          );
          return;
        }
        const job = await waitForJob(data.job.id);
        if (job.status === "deferred") {
          setStatus(
            "RTX offline — KI-Job wartet auf lokale RTX (deferred). Planung möglich, Ausführung folgt bei RTX-Bereitschaft.",
          );
          return;
        }
        payload = (job.result as typeof data) ?? data;
      }

      setContext(payload.context as AiContext);
      setRun(payload.run as AiRunView);
      const proposalList = (payload.proposals ?? []) as AiProposalView[];
      setProposals(proposalList);
      setEditedContents(
        Object.fromEntries(proposalList.map((p) => [p.id, p.content])),
      );
      setStatus(
        `Run ${payload.run.id} gespeichert — ${proposalList.length} Vorschlag/Vorschläge zur Prüfung.`,
      );
      void loadRecentRuns();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Brain-Aktion fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(proposalId: string) {
    if (!run) return;
    setLoading(true);
    setStatus(null);
    try {
      const response = await studioApiFetch(`/api/brain/runs/${run.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          proposalId,
          editedContent: editedContents[proposalId],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Übernahme fehlgeschlagen");
      }
      setRun(data.run as AiRunView);
      setStatus("Vorschlag übernommen — produktive Daten nur nach expliziter Bestätigung geändert.");
      void loadRecentRuns();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Übernahme fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDiscard() {
    if (!run) return;
    setLoading(true);
    setStatus(null);
    try {
      const response = await studioApiFetch(`/api/brain/runs/${run.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discard" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Verwerfen fehlgeschlagen");
      }
      setRun(data.run as AiRunView);
      setProposals([]);
      setStatus("Run verworfen.");
      void loadRecentRuns();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Verwerfen fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={`ai-brain-panel${isStoreVariant ? " ai-brain-panel-store" : ""}`}>
      {!isStoreVariant && <h3>UWE Brain</h3>}

      {isStoreVariant && !statusLoading && statusKind === "unavailable" && unavailableHint && (
        <p className="text-sm text-muted-foreground" role="note">
          {unavailableHint}
        </p>
      )}

      {isStoreVariant && !statusLoading && !rtxReady && statusKind !== "unavailable" && (
        <p className="text-sm text-destructive" role="note">
          {HINT_LOCAL_NOT_READY}
        </p>
      )}

      {isStoreVariant && rtxReady && (
        <p className="ai-brain-meta">
          Lokale RTX bereit — Weltwissen wird nicht an Cloud-KI gesendet.
        </p>
      )}

      {!isStoreVariant && settings && (
        <p className="ai-brain-meta">
          {settings.datenschutzMode ? "Datenschutzmodus aktiv" : "Cloud optional"}
          {settings.localOnly ? " · Nur lokal" : ""}
        </p>
      )}

      <label className="ai-brain-field">
        <span>Brain-Aktion</span>
        <select
          value={actionId}
          onChange={(event) => setActionId(event.target.value as BrainActionId)}
        >
          {actions.map((action) => (
            <option key={action.id} value={action.id}>
              {action.label}
            </option>
          ))}
        </select>
      </label>

      {selectedAction && (
        <p className="ai-brain-meta">{selectedAction.description}</p>
      )}

      {generatorActions && generatorActions.length > 0 && (
        <details className="ai-brain-context">
          <summary>Kontextuelle Generator-Aktionen ({generatorActions.length})</summary>
          <ul>
            {generatorActions.map((action) => (
              <li key={action.id}>
                {action.label}
                {action.playerSafe ? " (spieler-sicher)" : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      {needsSession && !fixedSessionId && (
        <label className="ai-brain-field">
          <span>Session</span>
          <select value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
            {sessions.length === 0 && <option value="">Keine Session verknüpft</option>}
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                #{session.sessionNumber} — {session.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {showLegacyProviderControls && (
        <label className="ai-brain-field">
          <span>Provider</span>
          <select
            value={providerId}
            onChange={(event) => setProviderId(event.target.value as AiProviderId)}
          >
            {availableProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {showLocalModelPicker && (
        <label className="ai-brain-field">
          <span>Modell</span>
          <select value={model} onChange={(event) => setModel(event.target.value)}>
            {models.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {showConnectorPicker && isStoreVariant && (
        <>
          <p className="ai-brain-meta">
            Modell vom Maschinenraum — Ausführung über die lokale Maschinenraum-Queue. Standards auf der{" "}
            <span className="ai-brain-strong">Kommandozentrale</span> auf dem Host.
          </p>
          <ConnectorModelPicker
            label="Modell"
            models={connectorModels}
            value={connectorSelection}
            onChange={handleConnectorSelection}
            noneLabel="— Standardmodell (lokale Inference)"
          />
        </>
      )}

      {showConnectorPicker && !isStoreVariant && (
        <details className="ai-brain-context">
          <summary>Connector-Modelle ({connectorModels.length})</summary>
          <p className="ai-brain-meta">
            Vom Maschinenraum gemeldete Modelle. Auswahl setzt das Modell für diesen Run; die
            Ausführung läuft lokal über die Maschinenraum-Queue. Standards pflegst du auf der{" "}
            <span className="ai-brain-strong">Kommandozentrale</span> auf dem Host.
          </p>
          <ConnectorModelPicker
            label="Connector-Modell verwenden"
            models={connectorModels}
            value={connectorSelection}
            onChange={handleConnectorSelection}
            noneLabel="— Keines (Provider-Modell oben nutzen)"
          />
        </details>
      )}

      {!settings?.localOnly && !isPlayerSafe && (
        <label className="ai-brain-checkbox">
          <input
            type="checkbox"
            checked={allowDmOnly}
            onChange={(event) => setAllowDmOnly(event.target.checked)}
          />
          DM-only-Inhalte einschließen (nur mit ausdrücklicher Erlaubnis)
        </label>
      )}

      {isPlayerSafe && (
        <p className="ai-brain-meta">Spieler-sichere Aktion — kein DM-only-Kontext.</p>
      )}

      <label className="ai-brain-field">
        <span>Zusätzlicher Prompt</span>
        <textarea
          value={userPrompt}
          onChange={(event) => setUserPrompt(event.target.value)}
          rows={3}
          placeholder="Optionale Anweisungen…"
        />
      </label>

      <div className="ai-brain-actions">
        <button type="button" onClick={() => void handleRunAction()} disabled={!canRunAction}>
          Aktion ausführen
        </button>
      </div>

      {loading && <LoadingState label="Brain-Aktion läuft…" size="sm" />}

      {!loading && proposals.length === 0 && !context && recentRuns.length === 0 && (
        <EmptyState
          title="Noch keine Vorschläge"
          description="Wähle eine Brain-Aktion und führe sie aus, um Vorschläge zu erhalten."
        />
      )}

      {context && (
        <details className="ai-brain-context">
          <summary>
            Kontext ({context.pages.length} Seiten
            {context.brainEntries?.length ? `, ${context.brainEntries.length} Brain-Einträge` : ""}
            {context.sessionId ? `, Session` : ""})
          </summary>
          <pre>{context.promptContext}</pre>
        </details>
      )}

      {proposals.length > 0 && run && (
        <div className="ai-brain-result">
          <h4>Vorschläge (Run {run.id.slice(0, 8)}…)</h4>
          {proposals.map((proposal) => (
            <div key={proposal.id} className="ai-brain-proposal">
              <strong>{proposal.label}</strong>
              {proposal.metadata?.mailDraft && (
                <p className="ai-brain-meta">
                  Mail-Entwurf — wird nicht automatisch versendet.
                  {proposal.metadata.subject ? ` Betreff: ${proposal.metadata.subject}` : ""}
                </p>
              )}
              <textarea
                value={editedContents[proposal.id] ?? proposal.content}
                onChange={(event) =>
                  setEditedContents((prev) => ({
                    ...prev,
                    [proposal.id]: event.target.value,
                  }))
                }
                rows={8}
                disabled={run.status === "applied" || run.status === "discarded"}
              />
              {run.status === "completed" && (
                <button
                  type="button"
                  onClick={() => void handleApply(proposal.id)}
                  disabled={loading}
                >
                  Übernehmen
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const text = editedContents[proposal.id] ?? proposal.content;
                  void navigator.clipboard.writeText(text).then(
                    () => setStatus("Vorschlag in Zwischenablage kopiert."),
                    () => setStatus("Kopieren fehlgeschlagen."),
                  );
                }}
                disabled={loading}
              >
                Kopieren
              </button>
            </div>
          ))}
          {run.status === "completed" && (
            <div className="ai-brain-actions">
              <button type="button" onClick={() => void handleRunAction()} disabled={loading}>
                Erneut generieren
              </button>
              <button type="button" onClick={() => void handleDiscard()} disabled={loading}>
                Alle verwerfen
              </button>
            </div>
          )}
        </div>
      )}

      {recentRuns.length > 0 && (
        <details className="ai-brain-context">
          <summary>Letzte Runs ({recentRuns.length})</summary>
          <ul>
            {recentRuns.map((entry) => (
              <li key={entry.id}>
                {entry.taskType} — {entry.status} — {formatStudioDate(entry.createdAt)}
              </li>
            ))}
          </ul>
        </details>
      )}

      {status && <p className="ai-brain-status">{status}</p>}
    </section>
  );
}
