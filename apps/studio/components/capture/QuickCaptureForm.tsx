"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useMemo, useState, useTransition } from "react";
import { QUICK_CAPTURE_TYPE_OPTIONS } from "@uwe/database/capture-constants";
import { createCaptureAction } from "@/app/capture-actions";
import { Button, Input, Textarea } from "@/src/components/ui";

const FIELD_CLASS = "flex flex-col gap-1.5 text-sm";

/** TODO(design-kit): Segmented Typ-Auswahl (role=listbox/option) — kein Kit-Äquivalent
 * (ToggleGroup) vorhanden; natives button + Tailwind + data-active verwendet. */
const TYPE_CHIP_CLASS =
  "min-h-11 rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2 text-left text-xs leading-tight text-foreground data-[active=true]:border-primary data-[active=true]:bg-primary/10";

interface Props {
  returnTo?: string;
  autoFocus?: boolean;
  compact?: boolean;
}

export function QuickCaptureForm({
  returnTo = "/capture",
  autoFocus = false,
  compact = false,
}: Props) {
  const [selectedId, setSelectedId] = useState(QUICK_CAPTURE_TYPE_OPTIONS[0]?.id ?? "quick_note");
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [uploadMime, setUploadMime] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, startUpload] = useTransition();
  const [isSubmitting, startSubmit] = useTransition();

  const selected = useMemo(
    () => QUICK_CAPTURE_TYPE_OPTIONS.find((option) => option.id === selectedId) ?? QUICK_CAPTURE_TYPE_OPTIONS[0],
    [selectedId],
  );

  if (!selected) {
    return null;
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    startUpload(async () => {
      const body = new FormData();
      body.append("file", file);
      body.append("uploadOnly", "1");
      body.append("captureType", selected.captureType);
      const response = await fetch(studioApiUrl("/api/capture/upload"), { method: "POST", body });
      const payload = (await response.json()) as {
        storageKey?: string;
        originalFilename?: string;
        mimeType?: string;
        error?: string;
      };
      if (!response.ok || !payload.storageKey) {
        setStorageKey(null);
        setUploadName(null);
        setUploadMime(null);
        setUploadError(payload.error ?? "Upload fehlgeschlagen");
        return;
      }
      setStorageKey(payload.storageKey);
      setUploadName(payload.originalFilename ?? file.name);
      setUploadMime(payload.mimeType ?? file.type ?? null);
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (selected.showFile && !storageKey) {
      setUploadError("Bitte zuerst eine Datei hochladen.");
      return;
    }
    if (storageKey) {
      formData.set("storageKey", storageKey);
      if (uploadMime) {
        formData.set(
          "metadataJson",
          JSON.stringify({ mimeType: uploadMime, originalFilename: uploadName }),
        );
      }
    }
    startSubmit(async () => {
      await createCaptureAction(formData);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="captureType" value={selected.captureType} />
      {selected.captureIntent ? (
        <input type="hidden" name="captureIntent" value={selected.captureIntent} />
      ) : null}
      {storageKey ? <input type="hidden" name="storageKey" value={storageKey} /> : null}

      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2"
        role="listbox"
        aria-label="Capture-Typ"
      >
        {QUICK_CAPTURE_TYPE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={option.id === selectedId}
            className={TYPE_CHIP_CLASS}
            data-active={option.id === selectedId ? "true" : "false"}
            onClick={() => {
              setSelectedId(option.id);
              setStorageKey(null);
              setUploadName(null);
              setUploadMime(null);
              setUploadError(null);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className={FIELD_CLASS}>
        Titel (optional)
        <Input name="title" type="text" placeholder="Kurzer Titel" autoComplete="off" />
      </label>

      <label className={FIELD_CLASS}>
        {selected.captureType === "link" ? "Notiz zum Link" : "Inhalt"}
        <Textarea
          name="content"
          rows={compact ? 3 : 4}
          required={
            selected.captureType !== "file_image" &&
            selected.captureType !== "voice_memo" &&
            selected.captureType !== "link"
          }
          placeholder={selected.placeholder}
          autoFocus={autoFocus}
        />
      </label>

      {selected.showUrl ? (
        <label className={FIELD_CLASS}>
          Link {selected.captureType === "link" ? "" : "(optional)"}
          <Input
            name="url"
            type="url"
            placeholder="https://…"
            required={selected.captureType === "link"}
          />
        </label>
      ) : null}

      {selected.showFile ? (
        <div className={FIELD_CLASS}>
          <span>{selected.captureType === "voice_memo" ? "Audio" : "Datei"}</span>
          <input
            type="file"
            accept={
              selected.fileAccept ??
              "image/*,application/pdf,.txt,.md,audio/*,.mp3,.wav,.ogg,.webm,.m4a"
            }
            onChange={handleFileChange}
            disabled={isUploading}
            className="text-sm text-foreground"
          />
          {uploadName ? <p className="mt-1 text-sm text-muted-foreground">✓ {uploadName}</p> : null}
          {isUploading ? <p className="mt-1 text-sm text-muted-foreground">Upload läuft …</p> : null}
        </div>
      ) : null}

      {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}

      <Button type="submit" disabled={isSubmitting || isUploading} className="h-11 w-full">
        {isSubmitting ? "Speichern …" : "Erfassen"}
      </Button>
    </form>
  );
}
