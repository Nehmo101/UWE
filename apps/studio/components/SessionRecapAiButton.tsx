"use client";

import Link from "next/link";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";

interface Props {
  worldSlug: string;
  sessionId: string;
  rtxReady: boolean;
  rtxEnabled: boolean;
}

export function SessionRecapAiButton({
  worldSlug,
  sessionId,
  rtxReady,
  rtxEnabled,
}: Props) {
  const [userPrompt, setUserPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  async function runSessionRecap() {
    setBusy(true);
    setStatus(null);
    setJobId(null);

    try {
      const response = await fetch(studioApiUrl("/api/brain/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: "session_recap",
          worldSlug,
          sessionId,
          providerId: "ollama",
          model: "llama3.2",
          userPrompt: userPrompt.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        job?: { id: string; status?: string };
        run?: { id: string };
      };

      if (!response.ok) {
        setStatus(payload.error ?? "Session-Recap fehlgeschlagen.");
        return;
      }

      if (response.status === 202) {
        setJobId(payload.job?.id ?? null);
        setStatus(
          payload.job?.status === "deferred"
            ? "RTX offline — Job vorgemerkt. Ergebnis unter AI Runs prüfen."
            : "KI-Recap gestartet — Vorschlag unter AI Runs prüfen und übernehmen.",
        );
        return;
      }

      if (payload.run?.id) {
        setStatus("Recap-Vorschlag erstellt — unter AI Runs prüfen.");
        return;
      }

      setStatus("Aktion abgeschlossen.");
    } catch {
      setStatus("Netzwerkfehler bei der KI-Zusammenfassung.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
      <h2 className="uwe-v2-section-title">KI-Recap (RTX)</h2>
      <p className="uwe-dashboard-muted">
        Strukturierte DM-Zusammenfassung aus Live-Einträgen — als Vorschlag, nicht automatisch
        Kanon.
      </p>

      {!rtxEnabled ? (
        <p className="uwe-form-error" role="alert">
          RTX-Inference ist deaktiviert.
        </p>
      ) : null}

      {rtxEnabled && !rtxReady ? (
        <p className="uwe-hint">RTX offline — wird als Job vorgemerkt.</p>
      ) : null}

      <label>
        Zusätzliche Anweisungen (optional)
        <textarea
          rows={2}
          value={userPrompt}
          placeholder="z. B. Fokus auf offene Quests, kurz und spielerfreundlich …"
          onChange={(event) => setUserPrompt(event.target.value)}
        />
      </label>

      <div className="uwe-form-actions">
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-secondary"
          disabled={!rtxEnabled || busy}
          onClick={() => void runSessionRecap()}
        >
          {busy ? "Läuft…" : "KI-Recap erstellen"}
        </button>
        <Link href={`/worlds/${worldSlug}/ai-runs`} className="uwe-v2-btn">
          AI Runs →
        </Link>
      </div>

      {status ? <p className="uwe-hint">{status}</p> : null}
      {jobId ? (
        <p>
          <Link href="/jobs">Job {jobId.slice(0, 8)}… anzeigen →</Link>
        </p>
      ) : null}
    </section>
  );
}
