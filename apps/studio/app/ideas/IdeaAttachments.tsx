"use client";

import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";

export interface IdeaAttachment {
  assetId: string;
  title?: string;
  mimeType?: string;
}

/** Served URL for an attachment asset (relative, honouring the studio path prefix). */
export function ideaAttachmentUrl(assetId: string): string {
  return studioApiUrl(`/api/assets/${assetId}/file`);
}

/** Absolute URL for an attachment asset — needed when handing images to Claude. */
export function ideaAttachmentAbsoluteUrl(assetId: string): string {
  const relative = ideaAttachmentUrl(assetId);
  if (/^https?:\/\//.test(relative)) return relative;
  if (typeof window !== "undefined") return `${window.location.origin}${relative}`;
  return relative;
}

interface IdeaAttachmentsProps {
  ideaId: string;
  attachments: IdeaAttachment[];
  onChange: (attachments: IdeaAttachment[]) => void;
}

/**
 * Upload / preview / remove image attachments for one dev idea. Uploads create a
 * `dm_only` asset; the resulting list is persisted so the images flow into the
 * KI-Chat, the generated prompt and the "Übergabe an Claude"-Handover.
 */
export function IdeaAttachments({ ideaId, attachments, onChange }: IdeaAttachmentsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: IdeaAttachment[]): Promise<void> {
    const res = await fetch(studioApiUrl(`/api/ideas/${ideaId}/attachments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachments: next }),
    });
    const data = (await res.json()) as { attachments?: IdeaAttachment[]; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? "Anhänge konnten nicht gespeichert werden.");
    }
    onChange(data.attachments ?? next);
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;

    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(studioApiUrl("/api/ideas/upload"), {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as {
        assetId?: string;
        title?: string;
        mimeType?: string;
        error?: string;
      };
      if (!res.ok || !data.assetId) {
        throw new Error(data.error ?? "Upload fehlgeschlagen.");
      }
      await persist([
        ...attachments,
        { assetId: data.assetId, title: data.title, mimeType: data.mimeType },
      ]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(assetId: string): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await persist(attachments.filter((attachment) => attachment.assetId !== assetId));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Entfernen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="uwe-idea-attachments">
      <label className="uwe-idea-attachments-add">
        Bilder anhängen (PNG, JPEG, GIF, WebP)
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={(event) => void handleUpload(event)}
          disabled={busy}
        />
      </label>
      {busy ? <p className="uwe-hint">Lädt hoch…</p> : null}
      {error ? <p className="uwe-hint uwe-hint-error">{error}</p> : null}
      {attachments.length > 0 ? (
        <ul className="uwe-idea-attachment-grid">
          {attachments.map((attachment, index) => (
            <li key={attachment.assetId} className="uwe-idea-attachment">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ideaAttachmentUrl(attachment.assetId)}
                alt={attachment.title ?? `Anhang ${index + 1}`}
                className="uwe-idea-attachment-image"
              />
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm"
                onClick={() => void handleRemove(attachment.assetId)}
                disabled={busy}
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="uwe-dashboard-muted">
          Noch keine Bilder angehängt. Angehängte Bilder werden dem Prompt und der Übergabe an
          Claude mitgegeben.
        </p>
      )}
    </div>
  );
}
