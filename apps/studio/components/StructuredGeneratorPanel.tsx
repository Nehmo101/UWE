"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import type {
  GeneratorActionDefinition,
  StructuredGeneratorField,
  StructuredGeneratorSchema,
} from "@uwe/database/generator-types";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@/src/components/ui";

interface Props {
  worldSlug: string;
  pageSlug: string;
  pageTitle: string;
  schema: StructuredGeneratorSchema;
  action: GeneratorActionDefinition;
  engineReady: boolean;
  engineEnabled: boolean;
}

export function StructuredGeneratorPanel({
  worldSlug,
  pageSlug,
  pageTitle,
  schema,
  action,
  engineReady,
  engineEnabled,
}: Props) {
  const initialValues = useMemo(
    () => Object.fromEntries(schema.fields.map((field) => [field.id, ""])),
    [schema.fields],
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  function updateField(field: StructuredGeneratorField, value: string) {
    setValues((current) => ({ ...current, [field.id]: value }));
  }

  async function runStructuredGenerator() {
    setBusy(true);
    setStatus(null);
    setJobId(null);

    try {
      const response = await fetch(studioApiUrl("/api/ai/generator"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: action.id,
          worldSlug,
          pageSlug,
          structuredInput: values,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        deferred?: boolean;
        jobId?: string;
        job?: { id: string };
        runId?: string;
      };

      if (!response.ok) {
        setStatus(payload.error ?? "Generierung fehlgeschlagen.");
        return;
      }

      if (response.status === 202 || payload.deferred) {
        const id = payload.jobId ?? payload.job?.id ?? null;
        setJobId(id);
        setStatus(
          payload.message ??
            "Maschinenraum offline — Job vorgemerkt. Kein Cloud-Fallback.",
        );
        return;
      }

      if (payload.runId) {
        setStatus("Strukturierter Vorschlag erstellt — Review unter AI Runs.");
        return;
      }

      setStatus("Aktion abgeschlossen.");
    } catch {
      setStatus("Netzwerkfehler bei der Generierung.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{schema.label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {schema.description} Für {pageTitle} — Maschinenraum-only, Review vor Übernahme.
        </p>

        {!engineEnabled && (
          <Alert tone="danger" role="alert">
            Maschinenraum-Inference ist deaktiviert.
          </Alert>
        )}

        {engineEnabled && !engineReady && (
          <p className="text-sm text-muted-foreground">Maschinenraum offline — wird als Job vorgemerkt.</p>
        )}

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void runStructuredGenerator();
          }}
        >
          {schema.fields.map((field) => (
            <div key={field.id} className="flex flex-col gap-1.5">
              <Label htmlFor={`structured-generator-${field.id}`}>
                {field.label}
                {field.required ? " *" : null}
              </Label>
              {field.kind === "textarea" ? (
                <Textarea
                  id={`structured-generator-${field.id}`}
                  rows={3}
                  value={values[field.id] ?? ""}
                  placeholder={field.placeholder}
                  required={field.required}
                  onChange={(event) => updateField(field, event.target.value)}
                />
              ) : (
                <Input
                  id={`structured-generator-${field.id}`}
                  type="text"
                  value={values[field.id] ?? ""}
                  placeholder={field.placeholder}
                  required={field.required}
                  onChange={(event) => updateField(field, event.target.value)}
                />
              )}
            </div>
          ))}

          <Button type="submit" disabled={!engineEnabled || busy} className="self-start">
            {busy ? "Läuft…" : action.label}
          </Button>
        </form>

        {status && <p className="text-sm text-muted-foreground">{status}</p>}
        {jobId && (
          <p>
            <Link href="/jobs" className="text-primary underline-offset-4 hover:underline">
              Job {jobId.slice(0, 8)}… anzeigen →
            </Link>
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/worlds/${worldSlug}/ai-runs`}
            className="text-primary underline-offset-4 hover:underline"
          >
            AI Runs & Review →
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
