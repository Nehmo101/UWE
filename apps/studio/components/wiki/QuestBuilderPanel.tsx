"use client";

import Link from "next/link";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import type {
  GeneratorActionDefinition,
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

export interface QuestPatronOption {
  title: string;
  slug: string;
}

/** TODO(design-kit): natives select bleibt — controlled Auftraggeber-Wahl mit
    Pflicht-Leerwert ("NPC wählen…"), siehe gleiches Muster in MagicItemBuilderPanel.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
    <Card id="quest-builder">
      <CardHeader>
        <CardTitle>Quest-Builder</CardTitle>
        <p className="text-sm text-muted-foreground">
          Strukturierte Quest für {pageTitle}: Auftraggeber, Ziel, Twist und Konsequenz —
          RTX-only, Ergebnis läuft als Review-Vorschlag (nie automatisch übernehmen).
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!rtxEnabled && (
          <Alert tone="danger" role="alert">
            RTX-Inference ist deaktiviert.
          </Alert>
        )}

        {rtxEnabled && !rtxReady && (
          <p className="text-sm text-muted-foreground">
            RTX offline — wird als Job vorgemerkt (kein Cloud-Fallback).
          </p>
        )}

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void runQuestGenerator();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quest-builder-patron">Auftraggeber (NPC der Welt) *</Label>
            <select
              id="quest-builder-patron"
              value={patronChoice}
              onChange={(event) => setPatronChoice(event.target.value)}
              required
              className={NATIVE_SELECT_CLASS}
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
          </div>

          {patronChoice === CUSTOM_PATRON && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quest-builder-patron-custom">Auftraggeber (Freitext) *</Label>
              <Input
                id="quest-builder-patron-custom"
                type="text"
                value={patronCustom}
                onChange={(event) => setPatronCustom(event.target.value)}
                placeholder="z. B. Die Bürgermeisterin von Phandalin"
                required
              />
            </div>
          )}

          {detailFields.map((field) => (
            <div key={field.id} className="flex flex-col gap-1.5">
              <Label htmlFor={`quest-builder-field-${field.id}`}>
                {field.label}
                {field.required ? " *" : null}
              </Label>
              {field.kind === "textarea" ? (
                <Textarea
                  id={`quest-builder-field-${field.id}`}
                  rows={3}
                  value={values[field.id] ?? ""}
                  placeholder={field.placeholder}
                  required={field.required}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.id]: event.target.value }))
                  }
                />
              ) : (
                <Input
                  id={`quest-builder-field-${field.id}`}
                  type="text"
                  value={values[field.id] ?? ""}
                  placeholder={field.placeholder}
                  required={field.required}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.id]: event.target.value }))
                  }
                />
              )}
            </div>
          ))}

          <Button type="submit" disabled={!rtxEnabled || busy} className="self-start">
            {busy ? "Läuft…" : action.label}
          </Button>
        </form>

        {status && <p className="text-sm text-muted-foreground">{status}</p>}
        {jobId && (
          <p className="text-sm">
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
