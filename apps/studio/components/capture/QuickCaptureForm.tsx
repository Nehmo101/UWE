"use client";

import { useMemo, useState, useTransition } from "react";
import { QUICK_CAPTURE_TYPE_OPTIONS } from "@uwe/database/capture-constants";
import { createCaptureAction } from "@/app/capture-actions";

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
      const response = await fetch("/api/capture/upload", { method: "POST", body });
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
    <form onSubmit={handleSubmit} className="uwe-capture-quick-form">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="captureType" value={selected.captureType} />
      {selected.captureIntent ? (
        <input type="hidden" name="captureIntent" value={selected.captureIntent} />
      ) : null}
      {storageKey ? <input type="hidden" name="storageKey" value={storageKey} /> : null}

      <div className="uwe-capture-type-grid" role="listbox" aria-label="Capture-Typ">
        {QUICK_CAPTURE_TYPE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={option.id === selectedId}
            className="uwe-capture-type-chip"
            data-active={option.id === selectedId ? "true" : "false"}
            onClick={() => {
              setSelectedId(option.id);
              setUploadError(null);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="uwe-capture-field">
        Titel (optional)
        <input name="title" type="text" placeholder="Kurzer Titel" autoComplete="off" />
      </label>

      <label className="uwe-capture-field">
        {selected.captureType === "link" ? "Notiz zum Link" : "Inhalt"}
        <textarea
          name="content"
          rows={compact ? 3 : 4}
          required={selected.captureType !== "file_image" && selected.captureType !== "link"}
          placeholder={selected.placeholder}
          autoFocus={autoFocus}
        />
      </label>

      {selected.showUrl ? (
        <label className="uwe-capture-field">
          Link {selected.captureType === "link" ? "" : "(optional)"}
          <input
            name="url"
            type="url"
            placeholder="https://…"
            required={selected.captureType === "link"}
          />
        </label>
      ) : null}

      {selected.showFile ? (
        <div className="uwe-capture-field">
          <span>Datei</span>
          <input
            type="file"
            accept="image/*,application/pdf,.txt,.md"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          {uploadName ? <p className="uwe-capture-upload-status">✓ {uploadName}</p> : null}
          {isUploading ? <p className="uwe-capture-upload-status">Upload läuft …</p> : null}
        </div>
      ) : null}

      {uploadError ? <p className="uwe-capture-error">{uploadError}</p> : null}

      <button
        type="submit"
        className="uwe-btn uwe-btn-primary uwe-capture-submit"
        disabled={isSubmitting || isUploading}
      >
        {isSubmitting ? "Speichern …" : "Erfassen"}
      </button>
    </form>
  );
}
