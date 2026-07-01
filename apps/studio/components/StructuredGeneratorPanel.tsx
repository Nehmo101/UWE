"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import type {
  GeneratorActionDefinition,
  StructuredGeneratorField,
  StructuredGeneratorSchema,
} from "@uwe/database/server";

interface Props {
  worldSlug: string;
  pageSlug: string;
  pageTitle: string;
  schema: StructuredGeneratorSchema;
  action: GeneratorActionDefinition;
  rtxReady: boolean;
  rtxEnabled: boolean;
}

export function StructuredGeneratorPanel({
  worldSlug,
  pageSlug,
  pageTitle,
  schema,
  action,
  rtxReady,
  rtxEnabled,
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
            "RTX offline — Job vorgemerkt. Kein Cloud-Fallback.",
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
    <section className="uwe-v2-card uwe-v2-section">
      <h2 className="uwe-v2-section-title">{schema.label}</h2>
      <p className="uwe-dashboard-muted">
        {schema.description} Für {pageTitle} — RTX-only, Review vor Übernahme.
      </p>

      {!rtxEnabled && (
        <p className="uwe-form-error" role="alert">
          RTX-Inference ist deaktiviert.
        </p>
      )}

      {rtxEnabled && !rtxReady && (
        <p className="uwe-hint">RTX offline — wird als Job vorgemerkt.</p>
      )}

      <form
        className="uwe-v2-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runStructuredGenerator();
        }}
      >
        {schema.fields.map((field) => (
          <label key={field.id}>
            {field.label}
            {field.required ? " *" : null}
            {field.kind === "textarea" ? (
              <textarea
                rows={3}
                value={values[field.id] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) => updateField(field, event.target.value)}
              />
            ) : (
              <input
                type="text"
                value={values[field.id] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) => updateField(field, event.target.value)}
              />
            )}
          </label>
        ))}

        <button
          type="submit"
          className="uwe-v2-btn uwe-v2-btn-primary"
          disabled={!rtxEnabled || busy}
        >
          {busy ? "Läuft…" : action.label}
        </button>
      </form>

      {status && <p className="uwe-hint">{status}</p>}
      {jobId && (
        <p>
          <Link href="/jobs">Job {jobId.slice(0, 8)}… anzeigen →</Link>
        </p>
      )}
      <p className="uwe-dashboard-muted">
        <Link href={`/worlds/${worldSlug}/ai-runs`}>AI Runs & Review →</Link>
      </p>
    </section>
  );
}
