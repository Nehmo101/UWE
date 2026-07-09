"use client";

import { useMemo, useState } from "react";

export interface LabelTemplatePreviewOption {
  id: string;
  name: string;
  description?: string | null;
  widthInches: number;
  heightInches: number;
  mode: string;
}

interface Props {
  templates: LabelTemplatePreviewOption[];
  defaultTemplateId?: string;
}

const MODE_LABELS: Record<string, string> = {
  image_text: "Bild + Text",
  text_only: "Nur Text",
  image_only: "Nur Bild",
};

export function LabelTemplatePreviewPicker({ templates, defaultTemplateId }: Props) {
  const [selectedId, setSelectedId] = useState(defaultTemplateId ?? templates[0]?.id ?? "");

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? templates[0],
    [templates, selectedId],
  );

  if (!selected) return null;

  const aspect = selected.widthInches / selected.heightInches;

  return (
    <div className="uwe-form-grid">
      <label>
        Vorlage
        <select
          name="templateId"
          required
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>

      <div
        className="uwe-v2-card"
        aria-live="polite"
        style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "auto 1fr" }}
      >
        <div
          aria-hidden
          style={{
            width: "5.5rem",
            aspectRatio: String(aspect),
            border: "2px dashed var(--uwe-border, #d4c4a8)",
            borderRadius: "0.35rem",
            background:
              "linear-gradient(135deg, var(--uwe-bg-elevated, #fbf6ea) 55%, rgba(148,163,184,0.15))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.7rem",
            color: "var(--uwe-muted)",
            textAlign: "center",
            padding: "0.25rem",
          }}
        >
          {selected.widthInches}×{selected.heightInches}&Prime;
        </div>
        <div>
          <strong>{selected.name}</strong>
          <p className="uwe-hint" style={{ margin: "0.25rem 0 0" }}>
            {MODE_LABELS[selected.mode] ?? selected.mode} · {selected.widthInches}×
            {selected.heightInches} Zoll
          </p>
          {selected.description && (
            <p className="uwe-table-sub" style={{ margin: "0.35rem 0 0" }}>
              {selected.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
