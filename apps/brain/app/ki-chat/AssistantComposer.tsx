"use client";

import { useCallback, useRef, useState } from "react";
import type {
  AssistantAttachmentView,
  AssistantCapabilityView,
} from "@uwe/brain-assistant/types";
import { useSpeechInput } from "@/src/lib/use-speech-input";

/** Files are uploaded as they are picked, so the send request stays small. */
async function uploadAttachment(
  conversationId: string,
  file: File,
): Promise<AssistantAttachmentView> {
  const formData = new FormData();
  formData.append("conversationId", conversationId);
  formData.append("file", file);

  const response = await fetch("/api/ai/assistant/attachments", {
    method: "POST",
    body: formData,
  });
  const data = (await response.json()) as {
    attachment?: AssistantAttachmentView;
    error?: string;
  };
  if (!response.ok || !data.attachment) {
    throw new Error(data.error ?? "Upload fehlgeschlagen.");
  }
  return data.attachment;
}

export function AssistantComposer({
  conversationId,
  capabilities,
  busy,
  onSend,
  onCancel,
}: {
  conversationId: string;
  capabilities: AssistantCapabilityView;
  busy: boolean;
  /** Resolves false when the turn failed, so the composer can restore its state. */
  onSend: (question: string, attachments: AssistantAttachmentView[]) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AssistantAttachmentView[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const speech = useSpeechInput({
    localAvailable: capabilities.sttAvailable,
    onTranscript: (text) => setInput((current) => (current ? `${current} ${text}` : text)),
  });

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploadError(null);
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const attachment = await uploadAttachment(conversationId, file);
          setAttachments((current) => [...current, attachment]);
        }
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
      } finally {
        setUploading(false);
      }
    },
    [conversationId],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(event.clipboardData.files);
      if (files.length > 0) {
        event.preventDefault();
        void addFiles(files);
      }
    },
    [addFiles],
  );

  const canSend = !busy && !uploading && (input.trim().length > 0 || attachments.length > 0);

  const submit = useCallback(async () => {
    if (!canSend) return;
    const question = input.trim();
    const pending = attachments;
    setInput("");
    setAttachments([]);

    // On failure give the question and its files back — re-typing and
    // re-uploading after a connector hiccup would be needless punishment.
    if (!(await onSend(question, pending))) {
      setInput((current) => (current ? `${question} ${current}` : question));
      setAttachments((current) => [...pending, ...current]);
    }
  }, [attachments, canSend, input, onSend]);

  return (
    <form
      className="brain-form brain-chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {attachments.length > 0 && (
        <ul className="brain-chat-attachments">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="brain-tag">
              {attachment.kind === "image" ? "🖼" : "📄"} {attachment.originalFilename}
              <button
                type="button"
                className="brain-btn-ghost brain-btn-sm"
                onClick={() =>
                  setAttachments((current) =>
                    current.filter((entry) => entry.id !== attachment.id),
                  )
                }
                aria-label={`${attachment.originalFilename} entfernen`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <label>
        Nachricht
        <textarea
          value={input}
          rows={3}
          disabled={busy}
          placeholder="Frage stellen … Bild oder PDF einfügen mit Strg+V."
          onChange={(event) => setInput(event.target.value)}
          onPaste={handlePaste}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submit();
            }
          }}
        />
      </label>

      <div className="brain-chat-actions">
        <button className="brain-btn" type="submit" disabled={!canSend}>
          Senden
        </button>
        {busy && (
          <button className="brain-btn-ghost" type="button" onClick={onCancel}>
            Abbrechen
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain"
          multiple
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          className="brain-btn-ghost"
          type="button"
          disabled={uploading || busy}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Lädt …" : "Anhang"}
        </button>

        {speech.supported && (
          <button
            className={speech.recording ? "brain-btn brain-chat-rec" : "brain-btn-ghost"}
            type="button"
            disabled={speech.busy || busy}
            aria-pressed={speech.recording}
            onClick={speech.toggle}
          >
            {speech.recording ? "Aufnahme stoppen" : speech.busy ? "Erkenne …" : "Diktieren"}
          </button>
        )}

        <span className="brain-muted">Strg + Enter sendet.</span>
      </div>

      {uploadError && (
        <p className="brain-callout brain-callout-warn" role="alert">
          {uploadError}
        </p>
      )}
      {speech.error && (
        <p className="brain-callout brain-callout-warn" role="alert">
          {speech.error}
        </p>
      )}

      {speech.supported && !capabilities.sttAvailable && (
        <label className="brain-muted brain-chat-optin">
          <input
            type="checkbox"
            checked={speech.browserFallbackAllowed}
            onChange={(event) => speech.enableBrowserFallback(event.target.checked)}
          />{" "}
          Browser-Spracherkennung als Notlösung erlauben — <strong>Achtung:</strong> dabei wird
          deine Stimme an den Browser-Hersteller gesendet, nicht lokal verarbeitet. Für echtes
          lokales Diktat im Command Center ein STT-Kommando hinterlegen.
        </label>
      )}
    </form>
  );
}
