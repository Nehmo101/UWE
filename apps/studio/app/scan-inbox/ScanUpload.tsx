"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { Button, Input } from "@/src/components/ui";

const FIELD_CLASS = "flex flex-col gap-1.5 text-sm";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" encType="multipart/form-data">
      <label className={FIELD_CLASS}>
        Titel (optional)
        <Input name="title" type="text" placeholder="z. B. Stromvertrag 2026" />
      </label>
      <label className={FIELD_CLASS}>
        Datei (Foto oder PDF)
        {/* TODO(design-kit): natives File-Input — Kit hat noch keine File-Input-Komponente. */}
        <input
          name="file"
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          required
          className="text-sm text-foreground"
        />
      </label>
      <Button type="submit" disabled={uploading}>
        {uploading ? "Lädt hoch…" : "Hochladen"}
      </Button>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </form>
  );
}
