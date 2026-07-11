"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useState } from "react";
import { Button, Input, Textarea } from "@/src/components/ui";

interface WorldOption {
  slug: string;
  name: string;
}

interface CaptureImageUploadProps {
  worlds: WorldOption[];
}

const FIELD_CLASS = "flex flex-col gap-1.5 text-sm";

/** TODO(design-kit): natives Select bleibt — Server-Action-Formular (FormData) braucht
    name-Attribut ohne Client-State, siehe gleiches Muster in QuickCaptureForm.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" encType="multipart/form-data">
      <label className={FIELD_CLASS}>
        Welt (optional — erstellt Asset in Medienbibliothek)
        <select name="worldSlug" defaultValue="" className={NATIVE_SELECT_CLASS}>
          <option value="">Nur Capture (ohne Asset)</option>
          {worlds.map((world) => (
            <option key={world.slug} value={world.slug}>
              {world.name}
            </option>
          ))}
        </select>
      </label>
      <label className={FIELD_CLASS}>
        Titel
        <Input name="title" type="text" placeholder="Miniatur Foto / Terrain Scan" />
      </label>
      <label className={FIELD_CLASS}>
        Notiz (optional)
        <Textarea name="content" rows={2} placeholder="Kontext zum Bild" />
      </label>
      <label className={FIELD_CLASS}>
        Bild
        {/* TODO(design-kit): natives File-Input — Kit hat noch keine File-Input-Komponente. */}
        <input
          name="file"
          type="file"
          accept="image/*"
          capture="environment"
          required
          className="text-sm text-foreground"
        />
      </label>
      <input type="hidden" name="captureType" value="file_image" />
      <Button type="submit" disabled={uploading}>
        {uploading ? "Lädt hoch…" : "Bild erfassen"}
      </Button>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </form>
  );
}
