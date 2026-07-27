"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_FIT_CHAT_MESSAGE_CHARS,
  type CampaignFitChatMessage,
} from "@uwe/pdf-campaign-import";
import { campaignFitChatAction } from "../import-campaign-chat-actions";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Textarea,
} from "@/src/components/ui";

interface Props {
  jobId: string;
  initialMessages: CampaignFitChatMessage[];
}

/**
 * Einordnungs-Konversation: Der Spielleiter bespricht mit der lokalen RTX-KI,
 * wie sich die importierte Kampagne in die bestehende Welt einfügt. Der
 * Verlauf wird serverseitig am Import-Job gespeichert.
 */
export function CampaignFitChatCard({ jobId, initialMessages }: Props) {
  const [messages, setMessages] = useState<CampaignFitChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages, sending]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) {
      return;
    }

    const nextMessages: CampaignFitChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const response = await campaignFitChatAction(jobId, nextMessages);
      setMessages(response.transcript);
    } catch (chatError) {
      setError(
        chatError instanceof Error
          ? chatError.message
          : "Die lokale KI konnte nicht antworten.",
      );
    } finally {
      setSending(false);
    }
  }, [input, jobId, messages, sending]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Einordnung in die Welt (lokale KI)</CardTitle>
        <CardDescription>
          Bespreche mit der lokalen RTX-KI, wie sich die importierte Kampagne in deine Welt
          einfügt — Anknüpfungspunkte, Konflikte mit bestehender Lore, Einbau-Vorschläge. Nach der
          PDF-Analyse kennt die KI zusätzlich die extrahierten Entitäten.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {messages.length > 0 ? (
          <div ref={listRef} className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={
                  message.role === "user"
                    ? "max-w-[85%] self-end whitespace-pre-wrap rounded-lg bg-primary/10 px-3 py-2 text-sm"
                    : "max-w-[85%] self-start whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm"
                }
              >
                {message.content}
              </div>
            ))}
            {sending ? (
              <div className="max-w-[85%] self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Lokale KI denkt nach…
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch keine Konversation — stelle die erste Frage, z. B. „Wie passt diese Kampagne in
            die Zeitlinie meiner Welt?“
          </p>
        )}

        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}

        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={2}
            maxLength={MAX_FIT_CHAT_MESSAGE_CHARS}
            placeholder="Frage an die lokale KI zur Einordnung der Kampagne…"
            aria-label="Nachricht an die lokale KI"
            className="flex-1"
          />
          <Button type="button" onClick={handleSend} disabled={sending || !input.trim()}>
            {sending ? "Sendet…" : "Senden"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
