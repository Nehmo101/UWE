"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useMemo, useState } from "react";
import { ErrorAlert, LoadingSpinner, StickyActionBar } from "@uwe/shared-ui";
import { AiPromptControls, computePromptUiState } from "@/components/AiPromptControls";
import { useAiPromptCapabilities } from "@/src/lib/use-ai-prompt-capabilities";

export interface MobileAiPromptPanelProps {
  worldSlug?: string;
  pageSlug?: string;
  pageTitle?: string;
  /** When true, uses mock AI providers (dev). */
  useMock?: boolean;
  /** Disable status polling (e.g. in tests). */
  pollIntervalMs?: number;
}

export function MobileAiPromptPanel({
  worldSlug,
  pageSlug,
  pageTitle,
  useMock = false,
  pollIntervalMs,
}: MobileAiPromptPanelProps) {
  const {
    caps,
    loading: statusLoading,
    error: statusError,
    providerMode,
    contextMode,
    setProviderMode,
    setContextMode,
  } = useAiPromptCapabilities({ worldSlug, pageSlug, pollIntervalMs });

  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ui = useMemo(
    () => computePromptUiState(providerMode, contextMode, caps, prompt),
    [providerMode, contextMode, caps, prompt],
  );

  async function handleSend() {
    if (!ui.canSend || loading) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(studioApiUrl("/api/ai/prompt"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          providerMode,
          contextMode,
          worldSlug,
          pageSlug,
          useMock,
        }),
      });

      const data = (await res.json()) as { text?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Anfrage fehlgeschlagen.");
      }

      setResponse(data.text ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anfrage fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  const displayError = error ?? statusError;

  return (
    <div className="mobile-ai-prompt uwe-has-sticky-actions">
      <AiPromptControls
        caps={caps}
        providerMode={providerMode}
        contextMode={contextMode}
        onProviderChange={setProviderMode}
        onContextChange={setContextMode}
        statusLoading={statusLoading}
        pageTitle={pageTitle}
        promptPreview={prompt}
      />

      <label className="mobile-ai-prompt-field">
        <span className="mobile-ai-prompt-label">Nachricht</span>
        <textarea
          className="mobile-ai-prompt-input"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Frage stellen oder Anweisung eingeben…"
          rows={6}
          disabled={loading}
          aria-describedby={displayError ? "mobile-ai-error" : undefined}
        />
      </label>

      {loading && (
        <div className="mobile-ai-loading" role="status" aria-live="polite">
          <LoadingSpinner label="KI antwortet…" />
        </div>
      )}

      {displayError && (
        <div id="mobile-ai-error">
          <ErrorAlert title="Fehler" message={displayError} />
        </div>
      )}

      {response && (
        <section className="mobile-ai-response" aria-label="Antwort">
          <h2 className="mobile-ai-response-title">Antwort</h2>
          <div className="mobile-ai-response-body">{response}</div>
        </section>
      )}

      <div className="mobile-ai-send-desktop">
        <button
          type="button"
          className="uwe-btn uwe-btn-primary mobile-ai-send-btn"
          disabled={!ui.canSend || loading}
          title={ui.sendBlockedReason}
          onClick={() => void handleSend()}
        >
          {loading ? "Senden…" : "Senden"}
        </button>
      </div>

      <StickyActionBar>
        <button
          type="button"
          className="uwe-btn uwe-btn-primary mobile-ai-send-btn"
          disabled={!ui.canSend || loading}
          title={ui.sendBlockedReason}
          onClick={() => void handleSend()}
        >
          {loading ? "Senden…" : "Senden"}
        </button>
      </StickyActionBar>
    </div>
  );
}
