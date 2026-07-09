"use client";

import { useMemo, useState } from "react";

type ExportFormat = "html" | "markdown";
type SheetLayout = "full" | "compact";

interface Props {
  worldSlug: string;
  characterId: string;
  worldName: string;
}

export function CharacterPrintFormatPicker({ worldSlug, characterId, worldName }: Props) {
  const [format, setFormat] = useState<ExportFormat>("html");
  const [layout, setLayout] = useState<SheetLayout>("full");

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams({
      characterId,
      format,
      layout,
    });
    return `/api/worlds/${worldSlug}/characters/print?${params.toString()}`;
  }, [worldSlug, characterId, format, layout]);

  return (
    <div className="uwe-v2-page">
      <h1>Charakterbogen — Druck / Export</h1>
      <p className="uwe-hint">Welt: {worldName}</p>

      <section className="uwe-v2-card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Format</h2>
        <div className="uwe-form-row uwe-form-row-2">
          <label>
            Ausgabe
            <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
              <option value="html">Druck-HTML (Browser/PDF)</option>
              <option value="markdown">Markdown-Export</option>
            </select>
          </label>
          <label>
            Layout
            <select
              value={layout}
              onChange={(event) => setLayout(event.target.value as SheetLayout)}
              disabled={format === "markdown"}
            >
              <option value="full">Vollständig (Zauber, Inventar, Notizen)</option>
              <option value="compact">Kompakt (Kernwerte)</option>
            </select>
          </label>
        </div>
        <p className="uwe-hint" style={{ margin: "0.5rem 0 0" }}>
          Kompakt blendet Zauberliste, Inventar und Notizen aus — ideal für Tischreferenz.
        </p>
        <p style={{ marginTop: "0.75rem" }}>
          <a href={exportUrl} target="_blank" rel="noreferrer" className="uwe-v2-btn uwe-v2-btn-primary">
            {format === "markdown" ? "Markdown öffnen" : "Druckansicht öffnen"}
          </a>
        </p>
      </section>

      {format === "html" && (
        <iframe
          title="Charakterbogen Druckvorschau"
          src={exportUrl}
          style={{ width: "100%", minHeight: "80vh", border: "1px solid #ccc" }}
        />
      )}
    </div>
  );
}
