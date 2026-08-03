"use client";

import Link from "next/link";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import type { GeneratorActionDefinition } from "@uwe/database/generator-types";
import { Button, Card, CardContent, CardHeader, CardTitle, Label, Input, Textarea } from "@/src/components/ui";

interface Props {
  worldSlug: string;
  pageSlug: string;
  pageTitle: string;
  action: GeneratorActionDefinition;
  currentDateLabel: string;
  factionStateSummary: string[];
  engineReady: boolean;
  engineEnabled: boolean;
}

export function FactionSimulatorPanel({
  worldSlug,
  pageSlug,
  pageTitle,
  action,
  currentDateLabel,
  factionStateSummary,
  engineReady,
  engineEnabled,
}: Props) {
  const [timeSkipDays, setTimeSkipDays] = useState("30");
  const [scenarioNote, setScenarioNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  async function runSimulation() {
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
          structuredInput: {
            timeSkipDays,
            scenarioNote,
          },
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
        setStatus(payload.error ?? "Simulation fehlgeschlagen.");
        return;
      }

      if (response.status === 202 || payload.deferred) {
        const id = payload.jobId ?? payload.job?.id ?? null;
        setJobId(id);
        setStatus(
          payload.message ??
            "Maschinenraum offline — Simulation vorgemerkt. Kein Cloud-Fallback.",
        );
        return;
      }

      if (payload.runId) {
        setStatus("Simulations-Vorschlag erstellt — Review unter AI Runs, dann Chronik.");
        return;
      }

      setStatus("Simulation abgeschlossen.");
    } catch {
      setStatus("Netzwerkfehler bei der Simulation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="faction-simulator">
      <CardHeader>
        <CardTitle>Fraktions-Simulator</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Maschinenraum-only KI-Simulation für {pageTitle} — erzeugt datierte Chronik-Events als Review-Vorschlag
          (nie automatisch übernehmen).
        </p>

        {!engineEnabled && (
          <p className="text-sm text-destructive" role="alert">
            Maschinenraum-Inference ist deaktiviert. Fraktions-Simulation ist nicht verfügbar.
          </p>
        )}

        {engineEnabled && !engineReady && (
          <p className="text-sm text-muted-foreground">
            Der Maschinenraum ist offline — Simulation wird als Job vorgemerkt (kein Cloud-Fallback).
          </p>
        )}

        <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Kontext</h3>
          <p className="text-sm text-muted-foreground">
            Aktuelles In-Game-Datum: <strong>{currentDateLabel}</strong>
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {factionStateSummary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Fraktions-State oben speichern, bevor du simulierst — der Simulator nutzt die strukturierten
            Felder im Prompt.
          </p>
        </div>

        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void runSimulation();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="faction-sim-time-skip">Zeitsprung (In-Game-Tage, optional)</Label>
            <Input
              id="faction-sim-time-skip"
              type="number"
              min={1}
              max={3650}
              value={timeSkipDays}
              onChange={(event) => setTimeSkipDays(event.target.value)}
              placeholder="30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="faction-sim-scenario">Fokus / Szenario (optional)</Label>
            <Textarea
              id="faction-sim-scenario"
              rows={3}
              value={scenarioNote}
              onChange={(event) => setScenarioNote(event.target.value)}
              placeholder="z. B. Handelskonflikt eskaliert, neuer Verbündeter, Rückzug aus Region X"
            />
          </div>

          <Button type="submit" disabled={!engineEnabled || busy} className="self-start">
            {busy ? "Simuliert…" : action.label}
          </Button>
        </form>

        {status && <p className="text-sm text-muted-foreground">{status}</p>}
        {jobId && (
          <p className="text-sm">
            <Link href="/jobs">Job {jobId.slice(0, 8)}… anzeigen →</Link>
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          <Link href={`/worlds/${worldSlug}/chronicle`}>Welt-Chronik →</Link>
          {" · "}
          <Link href={`/worlds/${worldSlug}/ai-runs`}>AI Runs & Review →</Link>
        </p>
      </CardContent>
    </Card>
  );
}
