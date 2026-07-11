"use client";

import { useRef, useState } from "react";
import { RtxStatusBadge, type RtxConnectorState } from "@uwe/shared-ui";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useAiPromptCapabilities } from "@/src/lib/use-ai-prompt-capabilities";
import { Alert, Button, Card, CardContent, Label, Textarea } from "@/src/components/ui";

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
    <Card aria-label="Life-Brain Chat">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 flex-[1_1_16rem] text-sm text-muted-foreground">
            Fragen an dein persönliches Wissen — läuft ausschließlich auf der lokalen RTX, niemals in
            der Cloud.
          </p>
          {!statusLoading && (
            <RtxStatusBadge state={caps.rtxState as RtxConnectorState} />
          )}
        </div>

        {!statusLoading && !rtxAvailable && (
          <Alert tone="warning" role="note">
            Lokale KI ist nicht bereit. Das Life-Brain hat keinen Cloud-Fallback — bitte RTX
            Connector starten.
          </Alert>
        )}

        <div
          ref={listRef}
          className="grid max-h-[50vh] gap-3 overflow-y-auto"
          aria-live="polite"
        >
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Noch keine Nachrichten. Beispiel: „Welche Filamente habe ich für den 3D-Drucker
              notiert?“
            </p>
          )}
          {messages.map((message, index) => (
            <Card
              key={`${message.role}-${index}`}
              className={message.role === "user" ? "bg-muted/60" : undefined}
            >
              <CardContent className="flex flex-col gap-1 pt-6">
                <p className="text-sm text-muted-foreground">
                  {message.role === "user" ? "Du" : "Life-Brain"}
                </p>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </CardContent>
            </Card>
          ))}
          {loading && <p className="text-sm text-muted-foreground">Antwort wird erstellt…</p>}
        </div>

        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="life-brain-chat-input">Frage</Label>
            <Textarea
              id="life-brain-chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Frage an dein Life-Brain stellen…"
              rows={3}
              disabled={loading}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={!canSend}>
              Senden
            </Button>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMessages([]);
                  setError(null);
                }}
                disabled={loading}
              >
                Verlauf leeren
              </Button>
            )}
            {lastModel && (
              <span className="text-sm text-muted-foreground">Modell: {lastModel} (lokal)</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
