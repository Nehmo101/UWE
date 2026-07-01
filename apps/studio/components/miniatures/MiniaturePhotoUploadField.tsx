"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useRef, useState } from "react";

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
    <div className="uwe-miniature-photo-upload">
      <p className="uwe-dashboard-muted">{label}</p>
      <div className="uwe-miniature-photo-slot">
        {assetId ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetPreviewUrl(assetId)} alt="" />
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
              onClick={() => onAssetChange(null)}
            >
              Entfernen
            </button>
          </>
        ) : (
          <p className="uwe-dashboard-muted">Noch kein Foto hochgeladen.</p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="uwe-miniature-photo-upload-input"
        onChange={handleFileChange}
        disabled={uploading}
        aria-hidden
        tabIndex={-1}
      />
      <button
        type="button"
        className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "Lädt hoch…" : assetId ? "Foto ersetzen" : "Foto hochladen"}
      </button>
      {error ? <p className="uwe-hint">{error}</p> : null}
    </div>
  );
}
