"use client";

import { useRef } from "react";
import { importPrintProfilesAction } from "./print-profile-actions";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

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
    <Card>
      <CardHeader>
        <CardTitle>Import / Export</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={exportJson}>
          Als JSON exportieren
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={importFile}
          aria-hidden
          tabIndex={-1}
        />
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
          JSON importieren
        </Button>
      </CardContent>
    </Card>
  );
}
