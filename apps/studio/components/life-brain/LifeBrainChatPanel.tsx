"use client";

import { useRef, useState } from "react";
import { ErrorAlert, LoadingSpinner, RtxStatusBadge, type RtxConnectorState } from "@uwe/shared-ui";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useAiPromptCapabilities } from "@/src/lib/use-ai-prompt-capabilities";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY_MESSAGES = 40;

export interface LifeBrainChatPanelProps {
  /** When true, uses mock AI providers (dev). */
  useMock?: boolean;
  /** Disable status polling (e.g. in tests). */
  pollIntervalMs?: number;
}

export function LifeBrainChatPanel({ useMock = false, pollIntervalMs }: LifeBrainChatPanelProps) {
  const { caps, loading: statusLoading } = useAiPromptCapabilities({ pollIntervalMs });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const rtxAvailable = caps.localAiReady || useMock;
  const canSend = input.trim().length > 0 && !loading && rtxAvailable;

  function scrollToEnd() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  }

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: question }].slice(
      -MAX_HISTORY_MESSAGES,
    );
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);
    scrollToEnd();

    try {
      const res = await fetch(studioApiUrl("/api/life-brain/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, useMock }),
      });

      const data = (await res.json()) as { text?: string; error?: string; model?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Anfrage fehlgeschlagen.");
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.text ?? "" },
      ]);
      setLastModel(data.model ?? null);
      scrollToEnd();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anfrage fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section" aria-label="Life-Brain Chat">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.65rem" }}>
        <p className="uwe-dashboard-muted" style={{ margin: 0, flex: "1 1 16rem" }}>
          Fragen an dein persönliches Wissen — läuft ausschließlich auf der lokalen RTX, niemals in
          der Cloud.
        </p>
        {!statusLoading && (
          <RtxStatusBadge state={caps.rtxState as RtxConnectorState} />
        )}
      </div>

      {!statusLoading && !rtxAvailable && (
        <p className="uwe-form-error" role="note">
          Lokale KI ist nicht bereit. Das Life-Brain hat keinen Cloud-Fallback — bitte RTX
          Connector starten.
        </p>
      )}

      <div
        ref={listRef}
        className="uwe-life-brain-chat-messages"
        style={{ maxHeight: "50vh", overflowY: "auto", display: "grid", gap: "0.75rem" }}
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="uwe-dashboard-muted">
            Noch keine Nachrichten. Beispiel: „Welche Filamente habe ich für den 3D-Drucker
            notiert?“
          </p>
        )}
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={
              message.role === "user" ? "uwe-today-card uwe-chat-user" : "uwe-today-card"
            }
          >
            <p className="uwe-dashboard-muted">
              {message.role === "user" ? "Du" : "Life-Brain"}
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>{message.content}</p>
          </article>
        ))}
        {loading && <LoadingSpinner label="Antwort wird erstellt…" />}
      </div>

      {error && <ErrorAlert message={error} />}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
        className="uwe-brain-create-form"
      >
        <label>
          Frage
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Frage an dein Life-Brain stellen…"
            rows={3}
            disabled={loading}
          />
        </label>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary" disabled={!canSend}>
            Senden
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-secondary"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              disabled={loading}
            >
              Verlauf leeren
            </button>
          )}
          {lastModel && (
            <span className="uwe-dashboard-muted">Modell: {lastModel} (lokal)</span>
          )}
        </div>
      </form>
    </section>
  );
}
