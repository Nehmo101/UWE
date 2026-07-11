"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/src/components/ui";

interface AgentJobsPollerProps {
  runningJobIds: string[];
}

export function AgentJobsPoller({ runningJobIds }: AgentJobsPollerProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeIds, setActiveIds] = useState(runningJobIds);

  useEffect(() => {
    setActiveIds(runningJobIds);
  }, [runningJobIds]);

  useEffect(() => {
    if (activeIds.length === 0) return undefined;

    const timer = window.setInterval(() => {
      void Promise.all(
        activeIds.map(async (jobId) => {
          const response = await fetch(studioApiUrl(`/api/agent-jobs/${jobId}`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "poll" }),
          });
          if (!response.ok) return null;
          const data = (await response.json()) as { job?: { status?: string } };
          return data.job?.status ?? null;
        }),
      ).then((statuses) => {
        const stillRunning = activeIds.filter((_id, index) => {
          const status = statuses[index];
          return status === "pending" || status === "dispatched" || status === "running";
        });
        if (stillRunning.length !== activeIds.length) {
          setActiveIds(stillRunning);
          startTransition(() => router.refresh());
        }
      });
    }, 10_000);

    return () => window.clearInterval(timer);
  }, [activeIds, router, startTransition]);

  if (activeIds.length === 0) return null;

  return (
    <p className="mb-4 text-sm text-muted-foreground">
      {activeIds.length} Agent-Job(s) laufen — Status wird alle 10 Sekunden aktualisiert.
    </p>
  );
}

interface AgentJobRetryButtonProps {
  jobId: string;
  disabled?: boolean;
}

export function AgentJobRetryButton({ jobId, disabled }: AgentJobRetryButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(studioApiUrl(`/api/agent-jobs/${jobId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Retry fehlgeschlagen.");
      }
      router.refresh();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Retry fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <Button type="button" variant="ghost" disabled={disabled || busy} onClick={() => void handleRetry()}>
        {busy ? "Starte…" : "Erneut versuchen"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </span>
  );
}
