"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, Label } from "@/src/components/ui";

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function highlightPromptBody(body: string, knownVariables: string[]): React.ReactNode[] {
  const known = new Set(knownVariables);
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_PATTERN.source, "g");

  while ((match = re.exec(body)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      parts.push(body.slice(lastIndex, start));
    }
    const name = match[1]!;
    parts.push(
      <mark
        key={`${name}-${start}`}
        className={
          known.has(name)
            ? "rounded bg-primary/15 px-0.5 text-foreground"
            : "rounded bg-destructive/15 px-0.5 text-destructive"
        }
        title={known.has(name) ? `Variable: ${name}` : `Unbekannte Variable: ${name}`}
      >
        {match[0]}
      </mark>,
    );
    lastIndex = start + match[0].length;
  }

  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [body];
}

interface Props {
  body: string;
  variables: string[];
}

export function PromptBodyEditor({ body, variables }: Props) {
  const highlighted = useMemo(() => highlightPromptBody(body, variables), [body, variables]);

  return (
    <div className="mb-6 flex flex-col gap-4">
      {variables.length > 0 ? (
        <Card className="mb-3">
          <CardHeader>
            <CardTitle>Variablen</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
              {variables.map((name) => (
                <li key={name}>
                  <code>{`{{${name}}}`}</code>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Keine dokumentierten Variablen — <code>{`{{name}}`}</code> im Body werden trotzdem hervorgehoben.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Body (Vorschau)</Label>
        <pre className="min-h-24 whitespace-pre-wrap rounded-md bg-muted p-3">{highlighted}</pre>
      </div>
    </div>
  );
}
