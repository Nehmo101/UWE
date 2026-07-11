"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "../ui/card";
import { Label } from "../ui/label";

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

/** TODO(design-kit): natives select bleibt — sendet templateId per FormData an eine
    Server-Action; Kit-Select (Radix) unterstützt kein natives name-Attribut dafür. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function LabelTemplatePreviewPicker({ templates, defaultTemplateId }: Props) {
  const [selectedId, setSelectedId] = useState(defaultTemplateId ?? templates[0]?.id ?? "");

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? templates[0],
    [templates, selectedId],
  );

  if (!selected) return null;

  const aspect = selected.widthInches / selected.heightInches;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="label-template-preview-picker">Vorlage</Label>
        <select
          id="label-template-preview-picker"
          name="templateId"
          required
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className={NATIVE_SELECT_CLASS}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>

      <Card aria-live="polite">
        <CardContent className="grid grid-cols-[auto_1fr] gap-3 p-4">
          {/* Echte Print-Vorschau: Seitenverhältnis/Farbverlauf sind aus den
              Vorlagenmaßen berechnet und bleiben als Inline-Style erhalten. */}
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
            <p className="mt-1 text-sm text-muted-foreground">
              {MODE_LABELS[selected.mode] ?? selected.mode} · {selected.widthInches}×
              {selected.heightInches} Zoll
            </p>
            {selected.description && (
              <p className="mt-1.5 text-sm text-muted-foreground">{selected.description}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
