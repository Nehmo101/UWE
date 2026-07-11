"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useState } from "react";
import Link from "next/link";
import type { GeneratorActionDefinition, MissingContentHint } from "@uwe/database/generator-types";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

interface ContextualGeneratorPanelProps {
  worldSlug: string;
  pageSlug: string;
  pageTitle: string;
  actions: GeneratorActionDefinition[];
  missingHints: MissingContentHint[];
  rtxReady: boolean;
  rtxEnabled: boolean;
}

export function ContextualGeneratorPanel({
  worldSlug,
  pageSlug,
  pageTitle,
  actions,
  missingHints,
  rtxReady,
  rtxEnabled,
}: ContextualGeneratorPanelProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  async function runAction(action: GeneratorActionDefinition) {
    setBusyAction(action.id);
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
            "RTX offline — Job vorgemerkt. Kein Cloud-Fallback. Ausführung sobald RTX bereit ist.",
        );
        return;
      }

      if (payload.runId) {
        setStatus(`Vorschlag erstellt — Review unter AI Runs.`);
        return;
      }

      setStatus("Aktion abgeschlossen.");
    } catch {
      setStatus("Netzwerkfehler bei der Generierung.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontext-Generator</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          KI-Aktionen für {pageTitle} — alle Vorschläge erfordern Review vor Übernahme.
        </p>

        {!rtxEnabled && (
          <Alert tone="danger" role="alert">
            RTX-Inference ist deaktiviert. Generator-Aktionen sind nicht verfügbar.
          </Alert>
        )}

        {rtxEnabled && !rtxReady && (
          <p className="text-sm text-muted-foreground">
            RTX ist offline — Aktionen werden als Job vorgemerkt (kein Cloud-Fallback).
          </p>
        )}

        {missingHints.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold tracking-tight">Fehlende Inhalte</h3>
            <ul className="list-disc pl-5 text-sm">
              {missingHints.map((hint) => (
                <li key={hint.field} data-severity={hint.severity}>
                  {hint.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map((action) => (
            <Card key={action.id}>
              <CardContent className="flex flex-col gap-2 pt-6">
                <h3 className="font-semibold tracking-tight">{action.label}</h3>
                <p className="text-sm text-muted-foreground">{action.description}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!rtxEnabled || busyAction !== null}
                  onClick={() => void runAction(action)}
                  className="self-start"
                >
                  {busyAction === action.id ? "Läuft…" : "Ausführen"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {status && <p className="text-sm text-muted-foreground">{status}</p>}
        {jobId && (
          <p>
            <Link href={`/jobs`} className="text-primary underline-offset-4 hover:underline">
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
