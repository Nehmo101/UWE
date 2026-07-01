"use client";

import Link from "next/link";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import type { GeneratorActionDefinition } from "@uwe/database/server";

interface Props {
  worldSlug: string;
  pageSlug: string;
  pageTitle: string;
  action: GeneratorActionDefinition;
  currentDateLabel: string;
  factionStateSummary: string[];
  rtxReady: boolean;
  rtxEnabled: boolean;
}

export function FactionSimulatorPanel({
  worldSlug,
  pageSlug,
  pageTitle,
  action,
  currentDateLabel,
  factionStateSummary,
  rtxReady,
  rtxEnabled,
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
            "RTX offline — Simulation vorgemerkt. Kein Cloud-Fallback.",
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
    <section className="uwe-v2-card uwe-v2-section" id="faction-simulator">
      <h2 className="uwe-v2-section-title">Fraktions-Simulator</h2>
      <p className="uwe-dashboard-muted">
        RTX-only KI-Simulation für {pageTitle} — erzeugt datierte Chronik-Events als Review-Vorschlag
        (nie automatisch übernehmen).
      </p>

      {!rtxEnabled && (
        <p className="uwe-form-error" role="alert">
          RTX-Inference ist deaktiviert. Fraktions-Simulation ist nicht verfügbar.
        </p>
      )}

      {rtxEnabled && !rtxReady && (
        <p className="uwe-hint">
          RTX ist offline — Simulation wird als Job vorgemerkt (kein Cloud-Fallback).
        </p>
      )}

      <div className="uwe-v2-section">
        <h3 className="uwe-v2-section-title">Kontext</h3>
        <p className="uwe-dashboard-muted">
          Aktuelles In-Game-Datum: <strong>{currentDateLabel}</strong>
        </p>
        <ul className="uwe-dashboard-muted">
          {factionStateSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="uwe-hint">
          Fraktions-State oben speichern, bevor du simulierst — der Simulator nutzt die strukturierten
          Felder im Prompt.
        </p>
      </div>

      <form
        className="uwe-v2-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runSimulation();
        }}
      >
        <label>
          Zeitsprung (In-Game-Tage, optional)
          <input
            type="number"
            min={1}
            max={3650}
            value={timeSkipDays}
            onChange={(event) => setTimeSkipDays(event.target.value)}
            placeholder="30"
          />
        </label>

        <label>
          Fokus / Szenario (optional)
          <textarea
            rows={3}
            value={scenarioNote}
            onChange={(event) => setScenarioNote(event.target.value)}
            placeholder="z. B. Handelskonflikt eskaliert, neuer Verbündeter, Rückzug aus Region X"
          />
        </label>

        <button
          type="submit"
          className="uwe-v2-btn uwe-v2-btn-primary"
          disabled={!rtxEnabled || busy}
        >
          {busy ? "Simuliert…" : action.label}
        </button>
      </form>

      {status && <p className="uwe-hint">{status}</p>}
      {jobId && (
        <p>
          <Link href="/jobs">Job {jobId.slice(0, 8)}… anzeigen →</Link>
        </p>
      )}
      <p className="uwe-dashboard-muted">
        <Link href={`/worlds/${worldSlug}/chronicle`}>Welt-Chronik →</Link>
        {" · "}
        <Link href={`/worlds/${worldSlug}/ai-runs`}>AI Runs & Review →</Link>
      </p>
    </section>
  );
}
