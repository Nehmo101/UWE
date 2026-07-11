"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useRef, useState } from "react";
import { Button } from "@/src/components/ui";

interface Props {
  label: string;
  assetId?: string | null;
  onAssetChange: (assetId: string | null) => void;
  uploadTitle?: string;
}

function assetPreviewUrl(assetId: string): string {
  return `/api/assets/${assetId}/file`;
}

export function MiniaturePhotoUploadField({
  label,
  assetId,
  onAssetChange,
  uploadTitle,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    if (uploadTitle) {
      formData.append("title", uploadTitle);
    }

    try {
      const response = await fetch(studioApiUrl("/api/miniatures/upload"), {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });
      const data = (await response.json()) as { error?: string; assetId?: string };
      if (!response.ok || !data.assetId) {
        setError(data.error ?? "Upload fehlgeschlagen.");
        return;
      }
      onAssetChange(data.assetId);
    } catch {
      setError("Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="grid gap-1.5">
        {assetId ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetPreviewUrl(assetId)}
              alt=""
              className="max-h-40 w-full rounded-[var(--radius)] bg-muted/20 object-cover"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="justify-self-start"
              onClick={() => onAssetChange(null)}
            >
              Entfernen
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Noch kein Foto hochgeladen.</p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleFileChange}
        disabled={uploading}
        aria-hidden
        tabIndex={-1}
      />
      <Button
        type="button"
        size="sm"
        className="justify-self-start"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "Lädt hoch…" : assetId ? "Foto ersetzen" : "Foto hochladen"}
      </Button>
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
    </div>
  );
}
