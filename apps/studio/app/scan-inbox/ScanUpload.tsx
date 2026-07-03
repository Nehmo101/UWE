"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";

export function ScanUpload() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setStatus(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch(studioApiUrl("/api/scan/upload"), {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });
      const data = (await response.json()) as { error?: string; id?: string };
      if (!response.ok || !data.id) {
        setStatus(data.error ?? "Upload fehlgeschlagen.");
        return;
      }
      form.reset();
      router.push(`/scan-inbox/${data.id}`);
    } catch {
      setStatus("Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="uwe-brain-create-form" encType="multipart/form-data">
      <label className="uwe-capture-field">
        Titel (optional)
        <input name="title" type="text" placeholder="z. B. Stromvertrag 2026" />
      </label>
      <label className="uwe-capture-field">
        Datei (Foto oder PDF)
        <input
          name="file"
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          required
        />
      </label>
      <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary" disabled={uploading}>
        {uploading ? "Lädt hoch…" : "Hochladen"}
      </button>
      {status && <p className="uwe-hint">{status}</p>}
    </form>
  );
}
