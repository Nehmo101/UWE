"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useEffect, useState } from "react";
import { Alert, Button, Input, Label } from "@/src/components/ui";

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
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={assetId} />
      {/* TODO(design-kit): Label umschließt den Input implizit (kein htmlFor/id) — die
          Komponente wird in Anlegen- und Bearbeiten-Formular gleichzeitig gerendert. */}
      <Label className="flex flex-col items-start gap-1.5">
        Screenshot (optional)
        <Input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={(event) => void handleFileChange(event)}
          disabled={uploading}
        />
      </Label>
      {uploading ? <p className="text-sm text-muted-foreground">Lädt hoch…</p> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {previewUrl ? (
        <div className="flex flex-col items-start gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Screenshot-Vorschau"
            className="mt-2 block max-h-80 max-w-full rounded-[var(--radius)] border border-border"
          />
          <Button type="button" variant="secondary" size="sm" onClick={handleClear} disabled={uploading}>
            Screenshot entfernen
          </Button>
        </div>
      ) : null}
    </div>
  );
}
