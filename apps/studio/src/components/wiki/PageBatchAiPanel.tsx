"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { waitForJob } from "@/src/lib/poll-job";
import type { AiBrainSettings, AiProviderId } from "@uwe/ai-brain";
import type { PageAiReviewAction } from "@uwe/page-ai-review";
import { startPageAiReviewBulkAction } from "@/app/worlds/[worldSlug]/page-ai-review-actions";

const ACTION_LABELS: Record<PageAiReviewAction, string> = {
  format: "KI ausarbeiten / formatieren",
  tags: "KI Tags",
  convert: "KI Konvertierung",
};

interface Props {
  worldSlug: string;
  selectedIds: string[];
  action: PageAiReviewAction;
  clearSelection: () => void;
}

export function PageBatchAiPanel({ worldSlug, selectedIds, action, clearSelection }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState<AiBrainSettings | null>(null);
  const [providerId, setProviderId] = useState<AiProviderId>("ollama");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [userPrompt, setUserPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableProviders = useMemo(() => {
    if (!settings) return [];
    return settings.providers.filter((provider) => {
      if (settings.localOnly) return provider.isLocal;
      return provider.enabled || provider.isLocal;
    });
  }, [settings]);

  useEffect(() => {
    void fetch(studioApiUrl("/api/ai/settings"))
      .then((response) => response.json())
      .then((data: { settings: AiBrainSettings }) => {
        setSettings(data.settings);
        const initialProvider =
          data.settings.providers.find((provider) => provider.enabled)?.id ??
          data.settings.providers[0]?.id ??
          "ollama";
        setProviderId(initialProvider as AiProviderId);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!providerId) return;
    void fetch(studioApiUrl(`/api/ai/models?provider=${providerId}`))
      .then((response) => response.json())
      .then((data: { models?: Array<{ id: string; name: string }> }) => {
        const list = data.models ?? [];
        setModels(list);
        setModel((current) => current || list[0]?.id || "");
      })
      .catch(() => undefined);
  }, [providerId]);

  const handleStart = useCallback(async () => {
    if (!model) {
      setError("Bitte ein Modell wählen.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    setProgress(`Starte ${selectedIds.length} KI-Job(s)…`);

    try {
      const result = await startPageAiReviewBulkAction(worldSlug, selectedIds, action, {
        providerId,
        model,
        userPrompt: userPrompt.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.message);
        setProgress(null);
        return;
      }

      let completed = 0;
      for (const jobId of result.jobIds) {
        setProgress(`KI läuft… ${completed}/${result.jobIds.length}`);
        await waitForJob(jobId);
        completed += 1;
      }

      setMessage(`${result.message} Seiten erscheinen unter „Texte zur Review“.`);
      setProgress(null);
      clearSelection();
      router.refresh();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "KI-Aktion fehlgeschlagen.");
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, [model, selectedIds, worldSlug, action, providerId, userPrompt, clearSelection, router]);

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm">
      <p className="font-medium">{ACTION_LABELS[action]}</p>
      <p className="text-muted-foreground">
        {selectedIds.length} Seite(n) — Ergebnisse landen in der Review-Warteschlange, nicht direkt
        im Kanon.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span>Provider</span>
          <select
            className="rounded-md border border-border bg-background px-2 py-1"
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
        <label className="flex flex-col gap-1">
          <span>Modell</span>
          <select
            className="rounded-md border border-border bg-background px-2 py-1"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          >
            {models.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span>Zusätzlicher Prompt (optional)</span>
        <textarea
          className="min-h-[72px] rounded-md border border-border bg-background p-2"
          value={userPrompt}
          onChange={(event) => setUserPrompt(event.target.value)}
          placeholder="z. B. Einheitliche Session-Struktur mit Überschriften…"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          onClick={() => void handleStart()}
          disabled={loading || selectedIds.length === 0}
        >
          {loading ? "KI läuft…" : `${ACTION_LABELS[action]} starten`}
        </button>
        {progress && <span className="text-muted-foreground">{progress}</span>}
        {message && !error && <span className="text-muted-foreground">✓ {message}</span>}
        {error && <span className="text-destructive">{error}</span>}
      </div>
    </div>
  );
}
