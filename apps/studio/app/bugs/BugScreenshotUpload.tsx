"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useEffect, useState } from "react";

interface BugScreenshotUploadProps {
  name?: string;
  initialAssetId?: string | null;
}

export function BugScreenshotUpload({
  name = "screenshotAssetId",
  initialAssetId = null,
}: BugScreenshotUploadProps) {
  const [assetId, setAssetId] = useState(initialAssetId ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    initialAssetId ? studioApiUrl(`/api/assets/${initialAssetId}/file`) : null,
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAssetId(initialAssetId ?? "");
    setPreviewUrl(
      initialAssetId ? studioApiUrl(`/api/assets/${initialAssetId}/file`) : null,
    );
    setError(null);
  }, [initialAssetId]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch(studioApiUrl("/api/bugs/upload"), {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as { assetId?: string; error?: string };
      if (!response.ok || !payload.assetId) {
        setError(payload.error ?? "Upload fehlgeschlagen.");
        setAssetId(initialAssetId ?? "");
        setPreviewUrl(
          initialAssetId ? studioApiUrl(`/api/assets/${initialAssetId}/file`) : null,
        );
        return;
      }

      URL.revokeObjectURL(localPreview);
      setAssetId(payload.assetId);
      setPreviewUrl(studioApiUrl(`/api/assets/${payload.assetId}/file`));
    } catch {
      setError("Upload fehlgeschlagen.");
      setAssetId(initialAssetId ?? "");
      setPreviewUrl(
        initialAssetId ? studioApiUrl(`/api/assets/${initialAssetId}/file`) : null,
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function handleClear() {
    setAssetId("");
    setPreviewUrl(null);
    setError(null);
  }

  return (
    <div className="uwe-bug-screenshot-upload">
      <input type="hidden" name={name} value={assetId} />
      <label className="uwe-capture-field">
        Screenshot (optional)
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={(event) => void handleFileChange(event)}
          disabled={uploading}
        />
      </label>
      {uploading ? <p className="uwe-hint">Lädt hoch…</p> : null}
      {error ? <p className="uwe-hint uwe-hint-error">{error}</p> : null}
      {previewUrl ? (
        <div className="uwe-bug-screenshot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Screenshot-Vorschau" className="uwe-bug-screenshot-image" />
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
            onClick={handleClear}
            disabled={uploading}
          >
            Screenshot entfernen
          </button>
        </div>
      ) : null}
    </div>
  );
}
