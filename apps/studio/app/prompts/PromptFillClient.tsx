"use client";

import { useMemo, useState } from "react";
import { Button, Input, Label } from "@/src/components/ui";

interface Props {
  body: string;
  variables: string[];
}

/** Ersetzt `{{name}}` durch die Werte; unbekannte Platzhalter bleiben leer. */
function fill(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: string) => values[name] ?? "");
}

export function PromptFillClient({ body, variables }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const filled = useMemo(() => fill(body, values), [body, values]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(filled);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {variables.length > 0 ? (
        <div className="flex flex-col gap-2">
          {variables.map((name) => (
            <div key={name} className="flex flex-col gap-1.5">
              <Label htmlFor={`prompt-fill-${name}`}>{name}</Label>
              <Input
                id={`prompt-fill-${name}`}
                type="text"
                value={values[name] ?? ""}
                onChange={(event) => setValues((prev) => ({ ...prev, [name]: event.target.value }))}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Keine Variablen — direkt kopierbar.</p>
      )}

      <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-3">{filled}</pre>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void copy()}>
          {copied ? "✓ Kopiert" : "Als Prompt kopieren"}
        </Button>
      </div>
    </div>
  );
}
