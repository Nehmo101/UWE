"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useState } from "react";

interface WorldOption {
  slug: string;
  name: string;
}

interface CaptureImageUploadProps {
  worlds: WorldOption[];
}

export function CaptureImageUpload({ worlds }: CaptureImageUploadProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setStatus(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch(studioApiUrl("/api/capture/upload"), {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });
      const data = (await response.json()) as { error?: string; captureId?: string; assetId?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Upload fehlgeschlagen.");
        return;
      }
      setStatus(
        data.assetId
          ? `Bild erfasst und als Asset verknüpft (${data.assetId.slice(0, 8)}…).`
          : `Capture erstellt (${data.captureId?.slice(0, 8)}…). Wähle eine Welt für Asset-Verknüpfung.`,
      );
      form.reset();
    } catch {
      setStatus("Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="uwe-brain-create-form" encType="multipart/form-data">
      <label className="uwe-capture-field">
        Welt (optional — erstellt Asset in Medienbibliothek)
        <select name="worldSlug" defaultValue="">
          <option value="">Nur Capture (ohne Asset)</option>
          {worlds.map((world) => (
            <option key={world.slug} value={world.slug}>
              {world.name}
            </option>
          ))}
        </select>
      </label>
      <label className="uwe-capture-field">
        Titel
        <input name="title" type="text" placeholder="Miniatur Foto / Terrain Scan" />
      </label>
      <label className="uwe-capture-field">
        Notiz (optional)
        <textarea name="content" rows={2} placeholder="Kontext zum Bild" />
      </label>
      <label className="uwe-capture-field">
        Bild
        <input name="file" type="file" accept="image/*" capture="environment" required />
      </label>
      <input type="hidden" name="captureType" value="file_image" />
      <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary" disabled={uploading}>
        {uploading ? "Lädt hoch…" : "Bild erfassen"}
      </button>
      {status && <p className="uwe-hint">{status}</p>}
    </form>
  );
}
