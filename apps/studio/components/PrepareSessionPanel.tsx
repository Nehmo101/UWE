"use client";

import Link from "next/link";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";

export interface PrepareSessionOption {
  id: string;
  title: string;
  sessionNumber: number;
}

interface Props {
  worldSlug: string;
  sessions: PrepareSessionOption[];
  defaultSessionId?: string;
  rtxReady: boolean;
  rtxEnabled: boolean;
}

export function PrepareSessionPanel({
  worldSlug,
  sessions,
  defaultSessionId,
  rtxReady,
  rtxEnabled,
}: Props) {
  const [sessionId, setSessionId] = useState(defaultSessionId ?? sessions[0]?.id ?? "");
  const [userPrompt, setUserPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  async function runPrepareNextSession() {
    if (!sessionId) {
      setStatus("Bitte eine Session auswählen.");
      return;
    }

    setBusy(true);
    setStatus(null);
    setJobId(null);

    try {
      const response = await fetch(studioApiUrl("/api/brain/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: "next_session_prep",
          worldSlug,
          sessionId,
          providerId: "ollama",
          model: "llama3.2",
          userPrompt: userPrompt.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        job?: { id: string; status?: string };
        run?: { id: string };
      };

      if (!response.ok) {
        setStatus(payload.error ?? "Session-Vorbereitung fehlgeschlagen.");
        return;
      }

      if (response.status === 202) {
        const id = payload.job?.id ?? null;
        setJobId(id);
        if (payload.job?.status === "deferred") {
          setStatus(
            "RTX offline — Job vorgemerkt. Kein Cloud-Fallback. Ausführung sobald RTX bereit ist.",
          );
        } else {
          setStatus("Session-Vorbereitung gestartet — Ergebnis unter AI Runs prüfen.");
        }
        return;
      }

      if (payload.run?.id) {
        setStatus("Session-Paket erstellt — Review unter AI Runs.");
        return;
      }

      setStatus("Aktion abgeschlossen.");
    } catch {
      setStatus("Netzwerkfehler bei der Session-Vorbereitung.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="uwe-v2-card uwe-v2-section">
      <h2 className="uwe-v2-section-title">Session vorbereiten</h2>
      <p className="uwe-dashboard-muted">
        KI-gestütztes Session-Paket (Recap, Plots, NPCs, Encounters) — RTX-only, Review vor
        Übernahme.
      </p>

      {!rtxEnabled && (
        <p className="uwe-form-error" role="alert">
          RTX-Inference ist deaktiviert.
        </p>
      )}

      {rtxEnabled && !rtxReady && (
        <p className="uwe-hint">RTX offline — wird als Job vorgemerkt.</p>
      )}

      {sessions.length === 0 ? (
        <p className="uwe-v2-empty">
          Noch keine Sessions vorhanden.{" "}
          <Link href={`/worlds/${worldSlug}/sessions/new`}>Erste Session anlegen →</Link>
        </p>
      ) : (
        <form
          className="uwe-v2-form"
          onSubmit={(event) => {
            event.preventDefault();
            void runPrepareNextSession();
          }}
        >
          <label>
            Bezugs-Session
            <select
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              required
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  #{session.sessionNumber} — {session.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            Zusätzliche Anweisungen (optional)
            <textarea
              rows={3}
              value={userPrompt}
              placeholder="z. B. Fokus auf Nepurga-Plot, mehr Sozial-Encounters …"
              onChange={(event) => setUserPrompt(event.target.value)}
            />
          </label>

          <button
            type="submit"
            className="uwe-v2-btn uwe-v2-btn-primary"
            disabled={!rtxEnabled || busy || !sessionId}
          >
            {busy ? "Läuft…" : "Nächste Session vorbereiten"}
          </button>
        </form>
      )}

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
