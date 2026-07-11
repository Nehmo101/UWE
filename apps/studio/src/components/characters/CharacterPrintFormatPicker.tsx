"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Label, buttonVariants } from "@/src/components/ui";

type ExportFormat = "html" | "markdown";
type SheetLayout = "full" | "compact";

interface Props {
  worldSlug: string;
  characterId: string;
  worldName: string;
}

/** TODO(design-kit): natives Select bleibt — direkt an lokalen State (format/layout) gebunden. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Charakterbogen — Druck / Export</h1>
        <p className="text-sm text-muted-foreground">Welt: {worldName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Format</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="character-print-format">Ausgabe</Label>
              <select
                id="character-print-format"
                className={NATIVE_SELECT_CLASS}
                value={format}
                onChange={(event) => setFormat(event.target.value as ExportFormat)}
              >
                <option value="html">Druck-HTML (Browser/PDF)</option>
                <option value="markdown">Markdown-Export</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="character-print-layout">Layout</Label>
              <select
                id="character-print-layout"
                className={NATIVE_SELECT_CLASS}
                value={layout}
                onChange={(event) => setLayout(event.target.value as SheetLayout)}
                disabled={format === "markdown"}
              >
                <option value="full">Vollständig (Zauber, Inventar, Notizen)</option>
                <option value="compact">Kompakt (Kernwerte)</option>
              </select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Kompakt blendet Zauberliste, Inventar und Notizen aus — ideal für Tischreferenz.
          </p>
          <p className="mt-3">
            <a href={exportUrl} target="_blank" rel="noreferrer" className={buttonVariants()}>
              {format === "markdown" ? "Markdown öffnen" : "Druckansicht öffnen"}
            </a>
          </p>
        </CardContent>
      </Card>

      {format === "html" && (
        <iframe
          title="Charakterbogen Druckvorschau"
          src={exportUrl}
          className="min-h-[80vh] w-full border border-border"
        />
      )}
    </div>
  );
}
