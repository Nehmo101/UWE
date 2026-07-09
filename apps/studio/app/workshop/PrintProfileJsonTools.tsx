"use client";

import { useRef } from "react";
import { importPrintProfilesAction } from "./print-profile-actions";

interface ExportProfile {
  name: string | null;
  printer: string | null;
  nozzle: string | null;
  filament: string | null;
  layerHeight: string | null;
  supports: string | null;
  result: string | null;
  errors: string | null;
  improvements: string | null;
  notes: string | null;
}

interface Props {
  profiles: ExportProfile[];
}

export function PrintProfileJsonTools({ profiles }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function exportJson() {
    const payload = profiles.map((profile) => ({
      name: profile.name ?? "",
      printer: profile.printer ?? "",
      nozzle: profile.nozzle ?? "",
      filament: profile.filament ?? "",
      layerHeight: profile.layerHeight ?? "",
      supports: profile.supports ?? "",
      result: profile.result ?? "",
      errors: profile.errors ?? "",
      improvements: profile.improvements ?? "",
      notes: profile.notes ?? "",
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "uwe-print-profiles.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const formData = new FormData();
    formData.set("json", text);
    await importPrintProfilesAction(formData);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <section className="uwe-v2-card uwe-v2-section">
      <h2 className="uwe-v2-section-title">Import / Export</h2>
      <div className="uwe-inline-actions">
        <button type="button" className="uwe-v2-btn uwe-v2-btn-secondary" onClick={exportJson}>
          Als JSON exportieren
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="uwe-miniature-photo-upload-input"
          onChange={importFile}
          aria-hidden
          tabIndex={-1}
        />
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-secondary"
          onClick={() => fileRef.current?.click()}
        >
          JSON importieren
        </button>
      </div>
    </section>
  );
}
