"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { waitForJob } from "@/src/lib/poll-job";
import {
  acceptPageReviewAction,
  refinePageReviewAction,
  rejectPageReviewAction,
} from "@/app/worlds/[worldSlug]/page-ai-review-actions";
import type { PageReviewDetail } from "@uwe/page-ai-review";
import type { AiBrainSettings, AiProviderId } from "@uwe/ai-brain";

interface Props {
  worldSlug: string;
  pageId: string;
  initialDetail: PageReviewDetail;
}

export function PageAiReviewEditor({ worldSlug, pageId, initialDetail }: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [editedContent, setEditedContent] = useState(initialDetail.editedContent);
  const [chatPrompt, setChatPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<AiBrainSettings | null>(null);
  const [providerId, setProviderId] = useState<AiProviderId>("ollama");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);

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

  const reloadDetail = useCallback(async () => {
    const response = await fetch(studioApiUrl(`/api/worlds/${worldSlug}/page-reviews/${pageId}`));
    if (!response.ok) return;
    const data = (await response.json()) as { detail: PageReviewDetail };
    setDetail(data.detail);
    setEditedContent(data.detail.editedContent);
  }, [worldSlug, pageId]);

  const handleAccept = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await acceptPageReviewAction(worldSlug, detail.proposalId, editedContent);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      router.push(`/worlds/${worldSlug}/page-review`);
      router.refresh();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Übernahme fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [worldSlug, detail.proposalId, editedContent, router]);

  const handleReject = useCallback(async () => {
    if (!window.confirm("Review ablehnen und vorherigen Status wiederherstellen?")) return;
    setLoading(true);
    setError(null);
    try {
      const result = await rejectPageReviewAction(
        worldSlug,
        detail.proposalId,
        rejectComment.trim() || undefined,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/worlds/${worldSlug}/page-review`);
      router.refresh();
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Ablehnung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [worldSlug, detail.proposalId, rejectComment, router]);

  const handleRefine = useCallback(async () => {
    if (!chatPrompt.trim() || !model) {
      setError("Bitte Prompt und Modell wählen.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await refinePageReviewAction(worldSlug, {
        pageId,
        proposalId: detail.proposalId,
        providerId,
        model,
        userPrompt: chatPrompt.trim(),
        currentDraft: editedContent,
      });
      if (!result.ok || !result.jobId) {
        setError(result.message);
        return;
      }

      setMessage("KI verfeinert den Text…");
      await waitForJob(result.jobId);
      await reloadDetail();
      setChatPrompt("");
      setMessage("Text aktualisiert.");
    } catch (refineError) {
      setError(refineError instanceof Error ? refineError.message : "Verfeinerung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [chatPrompt, model, providerId, worldSlug, pageId, detail.proposalId, editedContent, reloadDetail]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">{detail.pageTitle}</h2>
          {detail.suggestedTags.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Vorgeschlagene Tags: {detail.suggestedTags.join(", ")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <label className="flex flex-col gap-1 text-sm" style={{ flex: 1 }}>
            Ablehnungskommentar (optional)
            <input
              type="text"
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
              placeholder="Grund für Ablehnung…"
              disabled={loading}
            />
          </label>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:bg-muted disabled:opacity-60 self-end"
            onClick={() => void handleReject()}
            disabled={loading}
          >
            Ablehnen
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60 self-end"
            onClick={() => void handleAccept()}
            disabled={loading}
          >
            Übernehmen
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Original</h3>
          <pre className="min-h-[320px] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
            {detail.originalContent || "—"}
          </pre>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">KI-Text (bearbeitbar)</h3>
          <textarea
            className="min-h-[320px] w-full rounded-md border border-border bg-background p-3 text-sm"
            value={editedContent}
            onChange={(event) => setEditedContent(event.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border border-border p-4">
        <h3 className="mb-2 text-sm font-medium">KI-Chat — Änderungen anfordern</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
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
          <label className="flex flex-col gap-1 text-sm">
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
        <textarea
          className="mt-3 min-h-[96px] w-full rounded-md border border-border bg-background p-3 text-sm"
          placeholder="z. B. Formuliere kürzer und füge Wikilinks zu NPCs hinzu…"
          value={chatPrompt}
          onChange={(event) => setChatPrompt(event.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            onClick={() => void handleRefine()}
            disabled={loading}
          >
            {loading ? "Verfeinert…" : "Verfeinern"}
          </button>
          {message && <span className="text-sm text-muted-foreground">{message}</span>}
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>

        {detail.chatHistory.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {detail.chatHistory.map((entry, index) => (
              <li key={`${entry.createdAt}-${index}`} className="rounded-md bg-muted/40 p-2">
                <span className="font-medium">{entry.role === "user" ? "Du" : "KI"}:</span>{" "}
                {entry.content}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
