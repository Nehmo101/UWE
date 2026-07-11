"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorAlert, LoadingSpinner, StickyActionBar } from "@uwe/shared-ui";
import { AiPromptControls, computePromptUiState } from "@/components/AiPromptControls";
import { useAiPromptCapabilities } from "@/src/lib/use-ai-prompt-capabilities";
import { sanitizeAiErrorMessage } from "@/src/lib/ai-prompt-ui";

export interface MobileAiPromptPanelProps {
  worldSlug?: string;
  pageSlug?: string;
  pageTitle?: string;
  /** When true, uses mock AI providers (dev). */
  useMock?: boolean;
  /** Disable status polling (e.g. in tests). */
  pollIntervalMs?: number;
  /** full = /ai page; page = wiki sidebar on a single page. */
  variant?: "full" | "page";
}

export function MobileAiPromptPanel({
  worldSlug,
  pageSlug,
  pageTitle,
  useMock = false,
  pollIntervalMs,
  variant = "full",
}: MobileAiPromptPanelProps) {
  const isPageVariant = variant === "page" && Boolean(pageSlug);
  const {
    caps,
    loading: statusLoading,
    error: statusError,
    statusKind,
    unavailableHint,
    providerMode,
    contextMode,
    setProviderMode,
    setContextMode,
  } = useAiPromptCapabilities({ worldSlug, pageSlug, pollIntervalMs });

  const [includeBrain, setIncludeBrain] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPageVariant) {
      return;
    }
    setContextMode(includeBrain ? "current_object_plus_brain" : "current_object");
  }, [includeBrain, isPageVariant, setContextMode]);

  useEffect(() => {
    if (!isPageVariant) {
      return;
    }
    if (caps.localAiReady) {
      setProviderMode("local_rtx");
    }
  }, [caps.localAiReady, isPageVariant, setProviderMode]);

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
      const message = err instanceof Error ? err.message : "Anfrage fehlgeschlagen.";
      setError(sanitizeAiErrorMessage(message));
    } finally {
      setLoading(false);
    }
  }

  const aiUnavailable = statusKind === "unavailable";
  const rawDisplayError = error ?? (statusKind === "error" ? statusError : null);
  const displayError = rawDisplayError ? sanitizeAiErrorMessage(rawDisplayError) : null;
  const sendDisabled = !ui.canSend || loading || aiUnavailable;

  return (
    <div className={`mobile-ai-prompt uwe-has-sticky-actions${isPageVariant ? " mobile-ai-prompt-page" : ""}`}>
      <AiPromptControls
        caps={caps}
        providerMode={providerMode}
        contextMode={contextMode}
        onProviderChange={setProviderMode}
        onContextChange={setContextMode}
        statusLoading={statusLoading}
        pageTitle={pageTitle}
        promptPreview={prompt}
        variant={isPageVariant ? "page" : "full"}
      />

      {isPageVariant && (
        <label className="mobile-ai-page-brain-toggle">
          <input
            type="checkbox"
            checked={includeBrain}
            onChange={(event) => setIncludeBrain(event.target.checked)}
            disabled={loading || !caps.brainLocal}
          />
          DnD-Brain-Wissen einbeziehen
        </label>
      )}

      <label className="mobile-ai-prompt-field">
        <span className="mobile-ai-prompt-label">Nachricht</span>
        <textarea
          className="mobile-ai-prompt-input"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={
            isPageVariant
              ? "Seite verbessern, formatieren oder zusammenfassen…"
              : "Frage stellen oder Anweisung eingeben…"
          }
          rows={isPageVariant ? 4 : 6}
          disabled={loading}
          aria-describedby={displayError ? "mobile-ai-error" : undefined}
        />
      </label>

      {aiUnavailable && (
        <div className="mobile-ai-unavailable" aria-live="polite">
          <EmptyState
            title="KI nicht verfügbar"
            description={unavailableHint ?? "KI ist aktuell nicht verfügbar."}
          />
        </div>
      )}

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
          className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 mobile-ai-send-btn"
          disabled={sendDisabled}
          title={ui.sendBlockedReason}
          onClick={() => void handleSend()}
        >
          {loading ? "Senden…" : "Senden"}
        </button>
      </div>

      {!isPageVariant && (
        <StickyActionBar>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 mobile-ai-send-btn"
            disabled={sendDisabled}
            title={ui.sendBlockedReason}
            onClick={() => void handleSend()}
          >
            {loading ? "Senden…" : "Senden"}
          </button>
        </StickyActionBar>
      )}
    </div>
  );
}
