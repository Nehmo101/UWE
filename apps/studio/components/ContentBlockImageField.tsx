"use client";

import { useRef, useState } from "react";

export interface BlockImageAsset {
  id: string;
  title: string;
}

interface ContentBlockImageFieldProps {
  worldSlug: string;
  assets: BlockImageAsset[];
  /** Field name for the linked asset id (submitted with the block form). */
  assetIdName?: string;
  /** Field name for the caption (stored as the block content). */
  captionName?: string;
  defaultAssetId?: string | null;
  defaultCaption?: string;
}

/**
 * Bild-Block-Editor: lädt ein neues Bild hoch ODER wählt ein vorhandenes
 * Welt-Asset und verknüpft es über `assetId` mit dem ContentBlock. Der Upload
 * setzt die Asset-Sichtbarkeit auf „Portal sichtbar“, damit das Bild dort
 * angezeigt werden kann — ob der Block im Portal erscheint, steuert weiterhin
 * die Block-Sichtbarkeit.
 */
export function ContentBlockImageField({
  worldSlug,
  assets,
  assetIdName = "assetId",
  captionName = "content",
  defaultAssetId = null,
  defaultCaption = "",
}: ContentBlockImageFieldProps) {
  const [assetId, setAssetId] = useState(defaultAssetId ?? "");
  const [options, setOptions] = useState<BlockImageAsset[]>(assets);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewSrc = assetId ? `/api/assets/${assetId}/file` : null;

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("title", file.name);
      body.set("type", "image");
      body.set("visibility", "player_visible");

      const response = await fetch(`/api/worlds/${worldSlug}/assets/upload`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Upload fehlgeschlagen.");
      }

      const asset = (await response.json()) as { id: string; title: string };
      setOptions((current) =>
        current.some((option) => option.id === asset.id)
          ? current
          : [{ id: asset.id, title: asset.title }, ...current],
      );
      setAssetId(asset.id);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="uwe-v2-form" style={{ gap: "0.5rem" }}>
      <input type="hidden" name={assetIdName} value={assetId} />

      {previewSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewSrc}
          alt="Vorschau"
          style={{ maxWidth: "100%", maxHeight: "16rem", borderRadius: "0.5rem", objectFit: "contain" }}
        />
      ) : (
        <p className="uwe-field-hint" style={{ margin: 0 }}>
          Noch kein Bild gewählt.
        </p>
      )}

      <label>
        Bild hochladen
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
      </label>

      {options.length > 0 && (
        <label>
          Oder vorhandenes Bild wählen
          <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
            <option value="">— kein Bild —</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Bildunterschrift (optional)
        <input name={captionName} defaultValue={defaultCaption} placeholder="Beschreibung / Quelle" />
      </label>

      {uploading && <p className="uwe-field-hint" style={{ margin: 0 }}>Wird hochgeladen…</p>}
      {error && <p className="uwe-flash-error" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
