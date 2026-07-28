"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Upload eines Scans. Als Client-Komponente mit `fetch` statt Server-Action,
 * weil der Fortschritt sichtbar bleiben soll und wir nach dem Hochladen direkt
 * auf die Detailseite springen.
 *
 * `capture="environment"` öffnet auf dem Handy die Rückkamera — Belege
 * fotografiert man dort, wo sie anfallen.
 */
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
      const response = await fetch("/api/scan/upload", {
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
    <form onSubmit={handleSubmit} className="family-form family-card" encType="multipart/form-data">
      <label>
        Titel (optional)
        <input name="title" type="text" placeholder="z. B. Stromvertrag 2026" />
      </label>
      <label>
        Datei (Foto oder PDF)
        <input
          name="file"
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          required
        />
      </label>
      <div>
        <button type="submit" className="family-btn" disabled={uploading}>
          {uploading ? "Lädt hoch…" : "Hochladen"}
        </button>
      </div>
      {status ? <p className="family-muted">{status}</p> : null}
    </form>
  );
}
