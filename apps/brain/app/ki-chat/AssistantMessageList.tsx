"use client";

import type { AssistantMessageView } from "@uwe/brain-assistant/types";
import { useSpeechOutput } from "@/src/lib/use-speech-output";

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function AttachmentChips({ message }: { message: AssistantMessageView }) {
  if (message.attachments.length === 0) return null;
  return (
    <ul className="brain-chat-attachments">
      {message.attachments.map((attachment) => (
        <li key={attachment.id} className="brain-tag" title={attachment.extractedText ?? undefined}>
          {attachment.kind === "image" ? "🖼" : "📄"} {attachment.originalFilename}
        </li>
      ))}
    </ul>
  );
}

export function AssistantMessageList({ messages }: { messages: AssistantMessageView[] }) {
  const speech = useSpeechOutput();

  if (messages.length === 0) {
    return (
      <p className="brain-muted">
        Noch keine Nachrichten. Beispiel: „Fasse mir zusammen, was ich zu meinem 3D-Drucker
        notiert habe.“
      </p>
    );
  }

  return (
    <>
      {messages.map((message) => {
        const isUser = message.role === "user";
        return (
          <article
            key={message.id}
            className={isUser ? "brain-chat-msg is-user" : "brain-chat-msg"}
          >
            <p className="brain-chat-msg-head">
              <span className="brain-muted">
                {isUser ? "Du" : "Assistent"} · {formatTime(message.createdAt)}
                {message.model ? ` · ${message.model}` : ""}
              </span>
              {!isUser && message.content && speech.supported && (
                <button
                  type="button"
                  className="brain-btn-ghost brain-btn-sm"
                  onClick={() => speech.toggle(message.id, message.content)}
                  aria-pressed={speech.speakingId === message.id}
                >
                  {speech.speakingId === message.id ? "Stopp" : "Vorlesen"}
                </button>
              )}
            </p>

            {message.errorMessage ? (
              <p className="brain-callout brain-callout-warn" role="alert">
                {message.errorMessage}
              </p>
            ) : (
              <p className="brain-chat-body">{message.content}</p>
            )}

            <AttachmentChips message={message} />
          </article>
        );
      })}
    </>
  );
}
