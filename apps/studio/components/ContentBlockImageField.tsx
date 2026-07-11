"use client";

import { useRef, useState } from "react";
import { Input, Label } from "@/src/components/ui";

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

/** TODO(design-kit): natives select bleibt — Leerwert-Option ("kein Bild") ist mit
    dem Kit-Select (Radix) nicht abbildbar. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Bild-Block-Editor: lädt ein neues Bild hoch ODER wählt ein vorhandenes
 * Welt-Asset und verknüpft es über `assetId` mit dem ContentBlock. Der Upload
 * setzt die Asset-Sichtbarkeit auf „Portal sichtbar", damit das Bild dort
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
    <div className="flex flex-col gap-2">
      <input type="hidden" name={assetIdName} value={assetId} />

      {previewSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewSrc}
          alt="Vorschau"
          className="max-h-64 max-w-full rounded-lg object-contain"
        />
      ) : (
        <p className="m-0 text-xs text-muted-foreground">Noch kein Bild gewählt.</p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="content-block-image-upload">Bild hochladen</Label>
        <Input
          id="content-block-image-upload"
          ref={fileRef}
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
      </div>

      {options.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="content-block-image-select">Oder vorhandenes Bild wählen</Label>
          <select
            id="content-block-image-select"
            value={assetId}
            onChange={(event) => setAssetId(event.target.value)}
            className={NATIVE_SELECT_CLASS}
          >
            <option value="">— kein Bild —</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="content-block-image-caption">Bildunterschrift (optional)</Label>
        <Input
          id="content-block-image-caption"
          name={captionName}
          defaultValue={defaultCaption}
          placeholder="Beschreibung / Quelle"
        />
      </div>

      {uploading && <p className="m-0 text-xs text-muted-foreground">Wird hochgeladen…</p>}
      {error && <p className="m-0 text-sm text-destructive">{error}</p>}
    </div>
  );
}
