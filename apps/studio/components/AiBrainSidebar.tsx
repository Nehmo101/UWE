"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AiBrainSettings, AiContext, AiProviderId, AiTaskType } from "@uwe/ai-brain";
import { AI_TASK_LABELS } from "@uwe/ai-brain";

interface Props {
  worldSlug: string;
  pageSlug: string;
}

const TASK_TYPES = Object.keys(AI_TASK_LABELS) as AiTaskType[];

export function AiBrainSidebar({ worldSlug, pageSlug }: Props) {
  const [settings, setSettings] = useState<AiBrainSettings | null>(null);
  const [providerId, setProviderId] = useState<AiProviderId>("ollama");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [taskType, setTaskType] = useState<AiTaskType>("summarize_page");
  const [context, setContext] = useState<AiContext | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const [result, setResult] = useState("");
  const [ideaTitle, setIdeaTitle] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [allowDmOnly, setAllowDmOnly] = useState(false);

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
    const initialProvider = data.settings.providers.find((p) => p.id === data.settings.defaultProvider)
      ?? data.settings.providers.find((p) => p.isLocal);
    if (initialProvider) {
      setProviderId(initialProvider.id);
    }
  }, []);

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
  }, [loadSettings]);

  useEffect(() => {
    if (providerId) {
      void loadModels(providerId);
    }
  }, [providerId, loadModels]);

  async function handleLoadContext() {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/ai/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType,
          worldSlug,
          pageSlug,
          allowDmOnly,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Kontextfehler");
      }
      setContext(data.context as AiContext);
      setStatus(
        `Kontext geladen: ${data.context.pages.length} Seite(n)${data.context.truncated ? " (gekürzt)" : ""}.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kontext konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setStatus(null);
    setResult("");
    try {
      const useMock =
        process.env.NEXT_PUBLIC_AI_USE_MOCK === "true" ||
        model === "mock-model";
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType,
          worldSlug,
          pageSlug,
          providerId,
          model,
          userPrompt,
          allowDmOnly,
          useMock,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Generierung fehlgeschlagen");
      }
      setContext(data.context as AiContext);
      setResult(data.result.text as string);
      setStatus("Ergebnis generiert. Nicht automatisch als Kanon gespeichert.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(mode: "idea" | "content_block") {
    if (!result.trim()) {
      setStatus("Kein Ergebnis zum Speichern vorhanden.");
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          taskType,
          worldSlug,
          pageSlug,
          title: ideaTitle || undefined,
          content: result,
          providerId,
          model,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Speichern fehlgeschlagen");
      }
      setStatus(
        mode === "idea"
          ? `Als Idee gespeichert (${data.saved.canonicalStatus}).`
          : "Als ContentBlock (ai_summary, DM-only) gespeichert — nicht als Kanon.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ai-brain-panel">
      <h3>AI Brain</h3>

      {settings && (
        <p className="ai-brain-meta">
          {settings.datenschutzMode ? "Datenschutzmodus aktiv" : "Cloud optional"}
          {settings.localOnly ? " · Nur lokal" : ""}
        </p>
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

      <label className="ai-brain-field">
        <span>Aufgabe</span>
        <select
          value={taskType}
          onChange={(event) => setTaskType(event.target.value as AiTaskType)}
        >
          {TASK_TYPES.map((type) => (
            <option key={type} value={type}>
              {AI_TASK_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      {!settings?.localOnly && (
        <label className="ai-brain-checkbox">
          <input
            type="checkbox"
            checked={allowDmOnly}
            onChange={(event) => setAllowDmOnly(event.target.checked)}
          />
          DM-only-Inhalte einschließen (Cloud-Risiko)
        </label>
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
        <button type="button" onClick={() => void handleLoadContext()} disabled={loading}>
          Kontext laden
        </button>
        <button type="button" onClick={() => void handleGenerate()} disabled={loading || !model}>
          Prompt ausführen
        </button>
      </div>

      {context && (
        <details className="ai-brain-context">
          <summary>Kontext ({context.pages.length} Seiten)</summary>
          <pre>{context.promptContext}</pre>
          <ul>
            {context.sources.map((source) => (
              <li key={source.pageId}>
                {source.pageId}
                {source.blockIds?.length ? ` · ${source.blockIds.length} Blöcke` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      {result && (
        <div className="ai-brain-result">
          <h4>Ergebnis</h4>
          <pre>{result}</pre>
          <label className="ai-brain-field">
            <span>Ideen-Titel (optional)</span>
            <input
              value={ideaTitle}
              onChange={(event) => setIdeaTitle(event.target.value)}
              placeholder="Titel für Idee-Seite"
            />
          </label>
          <div className="ai-brain-actions">
            <button type="button" onClick={() => void handleSave("idea")} disabled={loading}>
              Als Idee speichern
            </button>
            <button
              type="button"
              onClick={() => void handleSave("content_block")}
              disabled={loading}
            >
              Als ContentBlock speichern
            </button>
          </div>
        </div>
      )}

      {status && <p className="ai-brain-status">{status}</p>}
    </section>
  );
}
