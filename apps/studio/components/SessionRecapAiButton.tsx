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
  Label,
  Textarea,
} from "@/src/components/ui";

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
    <Card>
      <CardHeader>
        <CardTitle>KI-Recap (RTX)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Strukturierte DM-Zusammenfassung aus Live-Einträgen — als Vorschlag, nicht automatisch
          Kanon.
        </p>

        {!rtxEnabled ? (
          <Alert tone="danger" role="alert">
            RTX-Inference ist deaktiviert.
          </Alert>
        ) : null}

        {rtxEnabled && !rtxReady ? (
          <p className="text-sm text-muted-foreground">RTX offline — wird als Job vorgemerkt.</p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="session-recap-prompt">Zusätzliche Anweisungen (optional)</Label>
          <Textarea
            id="session-recap-prompt"
            rows={2}
            value={userPrompt}
            placeholder="z. B. Fokus auf offene Quests, kurz und spielerfreundlich …"
            onChange={(event) => setUserPrompt(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!rtxEnabled || busy}
            onClick={() => void runSessionRecap()}
          >
            {busy ? "Läuft…" : "KI-Recap erstellen"}
          </Button>
          <Link href={`/worlds/${worldSlug}/ai-runs`} className={buttonVariants({ variant: "outline" })}>
            AI Runs →
          </Link>
        </div>

        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        {jobId ? (
          <p>
            <Link href="/jobs" className="text-primary underline-offset-4 hover:underline">
              Job {jobId.slice(0, 8)}… anzeigen →
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
