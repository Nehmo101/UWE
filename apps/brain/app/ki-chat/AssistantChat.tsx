"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AssistantAttachmentView,
  AssistantCapabilityView,
  AssistantMessageView,
} from "@uwe/brain-assistant/types";
import { AssistantMessageList } from "./AssistantMessageList";
import { AssistantComposer } from "./AssistantComposer";

/**
 * The interactive half of a conversation.
 *
 * Sending is a single blocking request — UWE has no streaming transport, so the
 * answer arrives whole. That makes an explicit pending state and a cancel path
 * important: a large local model can take a minute.
 */
export function AssistantChat({
  conversationId,
  initialMessages,
  capabilities,
  modelLabel,
  modelAvailable,
}: {
  conversationId: string;
  initialMessages: AssistantMessageView[];
  capabilities: AssistantCapabilityView;
  modelLabel: string | null;
  modelAvailable: boolean;
}) {
  const [messages, setMessages] = useState<AssistantMessageView[]>(initialMessages);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages.length, scrollToEnd]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (question: string, attachments: AssistantAttachmentView[]): Promise<boolean> => {
      setError(null);
      setPendingQuestion(question || "(nur Anhänge)");
      scrollToEnd();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/ai/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            question,
            attachmentIds: attachments.map((attachment) => attachment.id),
          }),
          signal: controller.signal,
        });

        const data = (await response.json()) as {
          message?: AssistantMessageView;
          messages?: AssistantMessageView[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Anfrage fehlgeschlagen.");
        }

        // The turn persisted both the question and the answer; take the whole
        // thread back so ids and attachment metadata match the database.
        if (data.messages) {
          setMessages(data.messages);
        } else if (data.message) {
          setMessages((current) => [...current, data.message as AssistantMessageView]);
        }
        return true;
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          setError("Anfrage abgebrochen.");
        } else {
          setError(caught instanceof Error ? caught.message : "Anfrage fehlgeschlagen.");
        }
        return false;
      } finally {
        abortRef.current = null;
        setPendingQuestion(null);
        scrollToEnd();
      }
    },
    [conversationId, scrollToEnd],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return (
    <section className="brain-section" aria-label="KI-Chat">
      <div className="brain-chat-meta">
        {modelLabel ? (
          <span className={modelAvailable ? "brain-tag" : "brain-tag brain-tag-warn"}>
            {modelLabel}
            {modelAvailable ? "" : " · offline"}
          </span>
        ) : (
          <span className="brain-muted">
            Keine KI hinterlegt — es wird der globale Connector-Standard verwendet.
          </span>
        )}
      </div>

      <div ref={logRef} className="brain-chat-log" aria-live="polite">
        <AssistantMessageList messages={messages} />
        {pendingQuestion && (
          <>
            <article className="brain-chat-msg is-user">
              <p className="brain-muted">Du</p>
              <p>{pendingQuestion}</p>
            </article>
            <p className="brain-muted">Antwort wird lokal erzeugt … das kann etwas dauern.</p>
          </>
        )}
      </div>

      {error && (
        <p className="brain-callout brain-callout-warn" role="alert">
          {error}
        </p>
      )}

      <AssistantComposer
        conversationId={conversationId}
        capabilities={capabilities}
        busy={pendingQuestion !== null}
        onSend={send}
        onCancel={cancel}
      />
    </section>
  );
}
