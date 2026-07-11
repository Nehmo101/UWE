"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { waitForJob } from "@/src/lib/poll-job";
import { JobProgressBar } from "./JobProgressBar";
import { Button, buttonVariants, Card, CardContent, CardHeader, CardTitle, NavIcon } from "@/src/components/ui";

interface Props {
  worldSlug: string;
}

export function InspectorDiagnosePanel({ worldSlug }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function runDiagnose() {
    setBusy(true);
    setStatus(null);
    setSummary(null);
    setProgress(null);
    setProgressLabel(null);
    setJobId(null);

    try {
      const response = await fetch(
        studioApiUrl(`/api/worlds/${encodeURIComponent(worldSlug)}/inspector/diagnose`),
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        error?: string;
        job?: { id: string };
      };

      if (!response.ok || !payload.job?.id) {
        setStatus(payload.error ?? "Diagnose konnte nicht gestartet werden.");
        return;
      }

      setJobId(payload.job.id);
      setStatus("Kanonprüfung läuft…");

      const job = await waitForJob(payload.job.id, {
        intervalMs: 600,
        timeoutMs: 180_000,
        onPoll: (snapshot) => {
          setProgress(snapshot.progress ?? null);
          setProgressLabel(snapshot.progressLabel ?? null);
        },
      });

      const result = job.result as
        | { findingCount?: number; criticalCount?: number }
        | undefined;

      const findingCount = result?.findingCount;
      const criticalCount = result?.criticalCount;
      if (typeof findingCount === "number") {
        setSummary(
          `${findingCount} Befunde (${criticalCount ?? 0} kritisch) — Seite aktualisiert.`,
        );
      } else {
        setSummary("Diagnose abgeschlossen — Seite aktualisiert.");
      }
      setStatus(null);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Diagnose fehlgeschlagen.");
    } finally {
      setBusy(false);
      setProgress(null);
      setProgressLabel(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Async-Diagnose</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Startet eine Hintergrund-Kanonprüfung und aktualisiert die Befunde, wenn der Job
          fertig ist.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={busy} onClick={() => void runDiagnose()}>
            {busy ? "Prüft…" : "Vollständige Diagnose starten"}
          </Button>
          {jobId ? (
            <Link href="/jobs" className={buttonVariants()}>
              Job {jobId.slice(0, 8)}…
            </Link>
          ) : null}
        </div>
        {busy ? (
          <JobProgressBar progress={progress ?? 10} label={progressLabel ?? "Welt analysieren…"} />
        ) : null}
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        {summary ? (
          <p role="status" className="flex items-center gap-2 text-sm text-success">
            <NavIcon name="check" width={16} height={16} />
            <span>{summary}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
