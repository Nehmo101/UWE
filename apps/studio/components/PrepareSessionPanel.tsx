"use client";

import Link from "next/link";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import {
  Alert,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Label,
  Textarea,
} from "@/src/components/ui";

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

/** TODO(design-kit): natives select bleibt — controlled Session-Auswahl ohne Kit-Select,
    siehe gleiches Muster in ReviewWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
    <Card>
      <CardHeader>
        <CardTitle>Session vorbereiten</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          KI-gestütztes Session-Paket (Recap, Plots, NPCs, Encounters) — RTX-only, Review vor
          Übernahme.
        </p>

        {!rtxEnabled && (
          <Alert tone="danger" role="alert">
            RTX-Inference ist deaktiviert.
          </Alert>
        )}

        {rtxEnabled && !rtxReady && (
          <p className="text-sm text-muted-foreground">RTX offline — wird als Job vorgemerkt.</p>
        )}

        {sessions.length === 0 ? (
          <EmptyState
            title="Noch keine Sessions vorhanden."
            action={
              <Link
                href={`/worlds/${worldSlug}/sessions/new`}
                className={buttonVariants({ variant: "outline" })}
              >
                Erste Session anlegen →
              </Link>
            }
          />
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void runPrepareNextSession();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prepare-session-id">Bezugs-Session</Label>
              <select
                id="prepare-session-id"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                required
                className={NATIVE_SELECT_CLASS}
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    #{session.sessionNumber} — {session.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prepare-session-prompt">Zusätzliche Anweisungen (optional)</Label>
              <Textarea
                id="prepare-session-prompt"
                rows={3}
                value={userPrompt}
                placeholder="z. B. Fokus auf Nepurga-Plot, mehr Sozial-Encounters …"
                onChange={(event) => setUserPrompt(event.target.value)}
              />
            </div>

            <Button type="submit" disabled={!rtxEnabled || busy || !sessionId} className="self-start">
              {busy ? "Läuft…" : "Nächste Session vorbereiten"}
            </Button>
          </form>
        )}

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
