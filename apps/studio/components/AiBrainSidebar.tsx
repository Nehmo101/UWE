"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { waitForJob } from "@/src/lib/poll-job";
import type { AiBrainSettings, AiContext, AiProviderId, DndGeneratorAction } from "@uwe/ai-brain";
import type { BrainActionDefinition, BrainActionId } from "@uwe/ai-brain";

interface Props {
  worldSlug: string;
  pageSlug?: string;
  sessionId?: string;
  defaultSessionId?: string;
  generatorActions?: DndGeneratorAction[];
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
  visibility?: string;
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
  generatorActions,
}: Props) {
  const [settings, setSettings] = useState<AiBrainSettings | null>(null);
  const [actions, setActions] = useState<BrainActionDefinition[]>([]);
  const [actionId, setActionId] = useState<BrainActionId>("expand_knowledge");
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
    const response = await fetch("/api/ai/settings");
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
    const response = await fetch("/api/brain/actions");
    if (!response.ok) return;
    const data = (await response.json()) as { actions: BrainActionDefinition[] };
    setActions(data.actions);
    if (data.actions.length > 0) {
      setActionId(data.actions[0].id);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    if (fixedSessionId) {
      setSessionId(fixedSessionId);
      return;
    }
    if (!pageSlug) return;

    const response = await fetch(
      `/api/ai/sessions?worldSlug=${encodeURIComponent(worldSlug)}&pageSlug=${encodeURIComponent(pageSlug)}`,
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

    const response = await fetch(`/api/brain/runs?${params.toString()}`);
    if (!response.ok) return;
    const data = (await response.json()) as { runs: AiRunView[] };
    setRecentRuns(data.runs);
  }, [worldSlug, pageSlug]);

  const loadModels = useCallback(async (selectedProvider: AiProviderId) => {
    const useMock = process.env.NEXT_PUBLIC_AI_USE_MOCK === "true";
    const response = await fetch(
      `/api/ai/models?provider=${selectedProvider}${useMock ? "&mock=true" : ""}`,
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

  useEffect(() => {
    void loadSettings();
    void loadActions();
    void loadSessions();
    void loadRecentRuns();
  }, [loadSettings, loadActions, loadSessions, loadRecentRuns]);

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
      const response = await fetch("/api/brain/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId,
          worldSlug,
          pageSlug: pageSlug || undefined,
          providerId,
          model,
          userPrompt,
          allowDmOnly,
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
      const response = await fetch(`/api/brain/runs/${run.id}`, {
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
      const response = await fetch(`/api/brain/runs/${run.id}`, {
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
    <section className="ai-brain-panel">
      <h3>UWE Brain</h3>

      {settings && (
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
        <button type="button" onClick={() => void handleRunAction()} disabled={loading || !model}>
          Aktion ausführen
        </button>
      </div>

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
                {entry.taskType} — {entry.status} — {new Date(entry.createdAt).toLocaleString("de-DE")}
              </li>
            ))}
          </ul>
        </details>
      )}

      {status && <p className="ai-brain-status">{status}</p>}
    </section>
  );
}
