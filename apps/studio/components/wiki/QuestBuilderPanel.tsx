"use client";

import Link from "next/link";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import type {
  GeneratorActionDefinition,
  StructuredGeneratorSchema,
} from "@uwe/database/generator-types";

export interface QuestPatronOption {
  title: string;
  slug: string;
}

interface Props {
  worldSlug: string;
  pageSlug: string;
  pageTitle: string;
  schema: StructuredGeneratorSchema;
  action: GeneratorActionDefinition;
  npcOptions: QuestPatronOption[];
  rtxReady: boolean;
  rtxEnabled: boolean;
}

const CUSTOM_PATRON = "__custom__";

export function QuestBuilderPanel({
  worldSlug,
  pageSlug,
  pageTitle,
  schema,
  action,
  npcOptions,
  rtxReady,
  rtxEnabled,
}: Props) {
  const [patronChoice, setPatronChoice] = useState(
    npcOptions.length > 0 ? "" : CUSTOM_PATRON,
  );
  const [patronCustom, setPatronCustom] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const detailFields = schema.fields.filter((field) => field.id !== "patron");
  const patron =
    patronChoice === CUSTOM_PATRON ? patronCustom.trim() : patronChoice.trim();

  async function runQuestGenerator() {
    if (!patron) {
      setStatus("Bitte einen Auftraggeber wählen oder eintragen.");
      return;
    }

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
          structuredInput: { ...values, patron },
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
        setStatus(payload.error ?? "Quest-Generierung fehlgeschlagen.");
        return;
      }

      if (response.status === 202 || payload.deferred) {
        const id = payload.jobId ?? payload.job?.id ?? null;
        setJobId(id);
        setStatus(payload.message ?? "RTX offline — Job vorgemerkt. Kein Cloud-Fallback.");
        return;
      }

      if (payload.runId) {
        setStatus("Quest-Vorschlag erstellt — Review unter AI Runs (keine automatische Übernahme).");
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
    <section className="uwe-v2-card uwe-v2-section" id="quest-builder">
      <h2 className="uwe-v2-section-title">Quest-Builder</h2>
      <p className="uwe-dashboard-muted">
        Strukturierte Quest für {pageTitle}: Auftraggeber, Ziel, Twist und Konsequenz —
        RTX-only, Ergebnis läuft als Review-Vorschlag (nie automatisch übernehmen).
      </p>

      {!rtxEnabled && (
        <p className="uwe-form-error" role="alert">
          RTX-Inference ist deaktiviert.
        </p>
      )}

      {rtxEnabled && !rtxReady && (
        <p className="uwe-hint">RTX offline — wird als Job vorgemerkt (kein Cloud-Fallback).</p>
      )}

      <form
        className="uwe-v2-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runQuestGenerator();
        }}
      >
        <label>
          Auftraggeber (NPC der Welt) *
          <select
            value={patronChoice}
            onChange={(event) => setPatronChoice(event.target.value)}
            required
          >
            <option value="" disabled>
              NPC wählen…
            </option>
            {npcOptions.map((npc) => (
              <option key={npc.slug} value={npc.title}>
                {npc.title}
              </option>
            ))}
            <option value={CUSTOM_PATRON}>Eigener Auftraggeber (Freitext)…</option>
          </select>
        </label>

        {patronChoice === CUSTOM_PATRON && (
          <label>
            Auftraggeber (Freitext) *
            <input
              type="text"
              value={patronCustom}
              onChange={(event) => setPatronCustom(event.target.value)}
              placeholder="z. B. Die Bürgermeisterin von Phandalin"
              required
            />
          </label>
        )}

        {detailFields.map((field) => (
          <label key={field.id}>
            {field.label}
            {field.required ? " *" : null}
            {field.kind === "textarea" ? (
              <textarea
                rows={3}
                value={values[field.id] ?? ""}
                placeholder={field.placeholder}
                required={field.required}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.id]: event.target.value }))
                }
              />
            ) : (
              <input
                type="text"
                value={values[field.id] ?? ""}
                placeholder={field.placeholder}
                required={field.required}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.id]: event.target.value }))
                }
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
