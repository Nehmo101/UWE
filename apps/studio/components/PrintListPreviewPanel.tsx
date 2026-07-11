"use client";

import { useState } from "react";
import { Button, buttonVariants, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

interface Props {
  exportUrl: string;
}

export function PrintListPreviewPanel({ exportUrl }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Druckvorschau</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          HTML-Vorschau der gesamten Druckliste — ohne neuen Tab zu öffnen.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setVisible((current) => !current)}>
            {visible ? "Vorschau ausblenden" : "Vorschau anzeigen"}
          </Button>
          <a
            href={exportUrl}
            className={buttonVariants({ variant: "secondary" })}
            target="_blank"
            rel="noreferrer"
          >
            In neuem Tab öffnen
          </a>
        </div>
        {visible ? (
          <iframe
            title="Drucklistenvorschau"
            src={exportUrl}
            className="mt-3 min-h-[28rem] w-full rounded-[var(--radius)] border border-border bg-white"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
