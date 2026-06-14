"use client";

import { useState } from "react";
import Link from "next/link";
import type { GeneratorActionDefinition, MissingContentHint } from "@uwe/database/server";

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
      const response = await fetch("/api/ai/generator", {
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
    <section className="uwe-card uwe-section">
      <h2 className="uwe-section-title">Kontext-Generator</h2>
      <p className="uwe-dashboard-muted">
        KI-Aktionen für {pageTitle} — alle Vorschläge erfordern Review vor Übernahme.
      </p>

      {!rtxEnabled && (
        <p className="uwe-form-error" role="alert">
          RTX-Inference ist deaktiviert. Generator-Aktionen sind nicht verfügbar.
        </p>
      )}

      {rtxEnabled && !rtxReady && (
        <p className="uwe-hint">
          RTX ist offline — Aktionen werden als Job vorgemerkt (kein Cloud-Fallback).
        </p>
      )}

      {missingHints.length > 0 && (
        <div className="uwe-section">
          <h3 className="uwe-section-title">Fehlende Inhalte</h3>
          <ul>
            {missingHints.map((hint) => (
              <li key={hint.field} data-severity={hint.severity}>
                {hint.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="uwe-today-card-list">
        {actions.map((action) => (
          <article key={action.id} className="uwe-today-card">
            <h3>{action.label}</h3>
            <p className="uwe-dashboard-muted">{action.description}</p>
            <button
              type="button"
              className="uwe-btn uwe-btn-secondary uwe-btn-sm"
              disabled={!rtxEnabled || busyAction !== null}
              onClick={() => void runAction(action)}
            >
              {busyAction === action.id ? "Läuft…" : "Ausführen"}
            </button>
          </article>
        ))}
      </div>

      {status && <p className="uwe-hint">{status}</p>}
      {jobId && (
        <p>
          <Link href={`/jobs`}>Job {jobId.slice(0, 8)}… anzeigen →</Link>
        </p>
      )}
      <p className="uwe-dashboard-muted">
        <Link href={`/worlds/${worldSlug}/ai-runs`}>AI Runs & Review →</Link>
      </p>
    </section>
  );
}
