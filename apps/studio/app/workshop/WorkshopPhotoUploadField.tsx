"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useRef, useState } from "react";

type PhotoCategory = "reference" | "progress" | "result";

interface Props {
  workshopId: string;
  category: PhotoCategory;
  label: string;
  textareaName: "referenceImages" | "progressPhotos" | "resultPhotos";
  defaultValue: string;
}

export function WorkshopPhotoUploadField({
  workshopId,
  category,
  label,
  textareaName,
  defaultValue,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(defaultValue);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("title", `Werkstatt ${workshopId} — ${label}`);

    try {
      const response = await fetch(studioApiUrl("/api/workshop/upload"), {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });
      const data = (await response.json()) as { error?: string; url?: string; caption?: string };
      if (!response.ok || !data.url) {
        setError(data.error ?? "Upload fehlgeschlagen.");
        return;
      }

      const line = `${data.url} | ${data.caption ?? label}`;
      const next = value.trim() ? `${value.trim()}\n${line}` : line;
      setValue(next);
      if (textareaRef.current) {
        textareaRef.current.value = next;
      }
    } catch {
      setError("Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <label>
      {label}
      <textarea
        ref={textareaRef}
        name={textareaName}
        rows={3}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
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
        className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{ marginTop: "0.35rem" }}
      >
        {uploading ? "Lädt hoch…" : "Foto hochladen"}
      </button>
      {error ? <p className="uwe-hint">{error}</p> : null}
    </label>
  );
}
