"use client";

import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { Alert, Button, Input, Label } from "@/src/components/ui";

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
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="idea-attachment-upload" className="text-sm">Bilder anhängen (PNG, JPEG, GIF, WebP)</Label>
        <Input
          id="idea-attachment-upload"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={(event) => void handleUpload(event)}
          disabled={busy}
        />
      </div>
      {busy ? <p className="text-sm text-muted-foreground">Lädt hoch…</p> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {attachments.length > 0 ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
          {attachments.map((attachment, index) => (
            <li key={attachment.assetId} className="flex flex-col items-start gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ideaAttachmentUrl(attachment.assetId)}
                alt={attachment.title ?? `Anhang ${index + 1}`}
                className="block max-h-40 w-full rounded-[var(--radius)] border border-border object-cover"
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => void handleRemove(attachment.assetId)} disabled={busy}>
                Entfernen
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Noch keine Bilder angehängt. Angehängte Bilder werden dem Prompt und der Übergabe an
          Claude mitgegeben.
        </p>
      )}
    </div>
  );
}
