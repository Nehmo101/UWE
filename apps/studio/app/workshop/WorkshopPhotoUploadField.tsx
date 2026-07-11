"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useId, useRef, useState } from "react";
import { Button, Label, Textarea } from "@/src/components/ui";

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
  const fieldId = useId();
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
      const data = (await response.json()) as {
        error?: string;
        url?: string;
        caption?: string;
      };
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
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <Textarea
        id={fieldId}
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
        className="sr-only"
        onChange={handleFileChange}
        disabled={uploading}
        aria-hidden
        tabIndex={-1}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-1 self-start"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "Lädt hoch…" : "Foto hochladen"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
