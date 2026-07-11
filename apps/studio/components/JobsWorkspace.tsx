"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, type BadgeProps, Button, Card, CardContent, Label, cn } from "@/src/components/ui";

interface JobLog {
  id: string;
  level: string;
  message: string;
  details: unknown;
  createdAt: string;
}

interface JobItem {
  id: string;
  type: string;
  status: string;
  title: string;
  worldSlug: string | null;
  errorMessage: string | null;
  progress: number | null;
  progressLabel: string | null;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  canRetry: boolean;
  canCancel: boolean;
  relatedType?: string | null;
  relatedId?: string | null;
  logs?: JobLog[];
}

interface JobSummary {
  pending: number;
  running: number;
  failed: number;
  completed: number;
  cancelled: number;
}

interface Props {
  initialJobs: JobItem[];
  initialSummary: JobSummary;
  typeLabels: Record<string, string>;
  statusLabels: Record<string, string>;
  worldSlug?: string;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
  timeStyle: "medium",
});

/** TODO(design-kit): Native select bleibt — controlled Filter mit Leerwert ("Alle"),
    siehe gleiches Muster in UserManagementWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function statusVariant(status: string): BadgeProps["variant"] {
  switch (status) {
    case "completed":
      return "success";
    case "running":
      return "info";
    case "failed":
      return "danger";
    case "cancelled":
      return "secondary";
    default:
      return "default";
  }
}

async function pollJob(jobId: string): Promise<JobItem | null> {
  const response = await fetch(studioApiUrl(`/api/jobs/${jobId}`));
  const data = await response.json();
  if (!response.ok) return null;
  return data.job as JobItem;
}

export function JobsWorkspace({
  initialJobs,
  initialSummary,
  typeLabels,
  statusLabels,
  worldSlug,
}: Props) {
  const [jobs, setJobs] = useState(initialJobs);
  const [summary, setSummary] = useState(initialSummary);
  const [selectedId, setSelectedId] = useState<string | null>(initialJobs[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedId) ?? null,
    [jobs, selectedId],
  );

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (worldSlug) params.set("worldSlug", worldSlug);

    const response = await fetch(studioApiUrl(`/api/jobs?${params.toString()}`));
    const data = await response.json();
    if (response.ok) {
      setJobs(data.jobs ?? []);
      setSummary(data.summary ?? summary);
    }
  }, [statusFilter, worldSlug, summary]);

  useEffect(() => {
    const hasActive = jobs.some((job) => job.status === "pending" || job.status === "running");
    if (!hasActive) return;

    const timer = setInterval(() => {
      void refresh();
    }, 2000);

    return () => clearInterval(timer);
  }, [jobs, refresh]);

  useEffect(() => {
    if (!selectedId) return;
    const job = jobs.find((entry) => entry.id === selectedId);
    if (job && (job.status === "pending" || job.status === "running") && !job.logs) {
      void pollJob(selectedId).then((detail) => {
        if (detail) {
          setJobs((current) =>
            current.map((entry) => (entry.id === detail.id ? { ...entry, ...detail } : entry)),
          );
        }
      });
    }
  }, [selectedId, jobs]);

  async function loadDetail(jobId: string) {
    setSelectedId(jobId);
    const detail = await pollJob(jobId);
    if (detail) {
      setJobs((current) =>
        current.map((entry) => (entry.id === detail.id ? { ...entry, ...detail } : entry)),
      );
    }
  }

  async function retryJob(jobId: string) {
    setBusy(jobId);
    setError(null);
    try {
      const response = await fetch(studioApiUrl(`/api/jobs/${jobId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Retry fehlgeschlagen.");
      }
      await refresh();
      await loadDetail(jobId);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Retry fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function cancelJob(jobId: string) {
    setBusy(jobId);
    setError(null);
    try {
      const response = await fetch(studioApiUrl(`/api/jobs/${jobId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Abbruch fehlgeschlagen.");
      }
      await refresh();
      await loadDetail(jobId);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Abbruch fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <StatGrid summary={summary} />

      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jobs-status-filter">Status</Label>
          <select
            id="jobs-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={NATIVE_SELECT_CLASS}
          >
            <option value="">Alle</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="secondary" onClick={() => void refresh()}>
          Aktualisieren
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
        <div className="flex flex-col gap-2">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Jobs vorhanden.</p>
          ) : (
            jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => void loadDetail(job.id)}
                className={cn(
                  "flex flex-col gap-1.5 rounded-[var(--radius)] border border-border bg-card p-4 text-left text-sm text-card-foreground shadow-sm transition-colors hover:border-primary/60",
                  selectedId === job.id && "border-primary bg-muted",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <strong>{job.title}</strong>
                  <Badge variant={statusVariant(job.status)}>{statusLabels[job.status] ?? job.status}</Badge>
                </div>
                <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                  <span>{typeLabels[job.type] ?? job.type}</span>
                  <span>{DATE_FORMAT.format(new Date(job.createdAt))}</span>
                </div>
                {job.progress != null && job.status === "running" && (
                  <div className="flex flex-col gap-1 pt-1 text-xs text-muted-foreground">
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={job.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full rounded-full bg-primary" style={{ width: `${job.progress}%` }} />
                    </div>
                    <span>{job.progressLabel ?? `${job.progress}%`}</span>
                  </div>
                )}
                {job.errorMessage && (
                  <p className="truncate text-xs text-destructive">{job.errorMessage}</p>
                )}
              </button>
            ))
          )}
        </div>

        <Card className="min-w-0">
          <CardContent className="flex flex-col gap-4 pt-6">
            {selectedJob ? (
              <>
                <header className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedJob.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {typeLabels[selectedJob.type] ?? selectedJob.type} ·{" "}
                      {statusLabels[selectedJob.status] ?? selectedJob.status}
                      {selectedJob.worldSlug ? ` · Welt ${selectedJob.worldSlug}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.canCancel && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy === selectedJob.id}
                        onClick={() => void cancelJob(selectedJob.id)}
                      >
                        Abbrechen
                      </Button>
                    )}
                    {selectedJob.canRetry && (
                      <Button
                        type="button"
                        disabled={busy === selectedJob.id}
                        onClick={() => void retryJob(selectedJob.id)}
                      >
                        Erneut versuchen
                      </Button>
                    )}
                  </div>
                </header>

                {selectedJob.errorMessage && (
                  <Alert tone="danger" role="alert">
                    <strong>Fehler:</strong> {selectedJob.errorMessage}
                  </Alert>
                )}

                <p className="text-sm text-muted-foreground">
                  Versuch {selectedJob.attemptCount}/{selectedJob.maxAttempts} · erstellt{" "}
                  {DATE_FORMAT.format(new Date(selectedJob.createdAt))}
                </p>

                {selectedJob.relatedType === "ai_run" && selectedJob.relatedId && selectedJob.worldSlug && (
                  <p>
                    <Link href={`/worlds/${selectedJob.worldSlug}/ai-runs/${selectedJob.relatedId}`}>
                      AI Run anzeigen
                    </Link>
                  </p>
                )}

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Protokoll</h3>
                  {selectedJob.logs && selectedJob.logs.length > 0 ? (
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {selectedJob.logs.map((log) => (
                        <li
                          key={log.id}
                          className="flex items-baseline gap-3 rounded-[var(--radius)] bg-muted/50 px-2 py-1.5"
                        >
                          <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {DATE_FORMAT.format(new Date(log.createdAt))}
                          </time>
                          <span
                            className={cn(
                              log.level === "warn" && "text-warning",
                              log.level === "error" && "text-destructive",
                            )}
                          >
                            {log.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Noch keine Log-Einträge.</p>
                  )}
                </section>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Wähle einen Job aus der Liste.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatGrid({ summary }: { summary: JobSummary }) {
  const items = [
    { label: "Wartend", value: summary.pending },
    { label: "Läuft", value: summary.running },
    { label: "Fehlgeschlagen", value: summary.failed },
    { label: "Abgeschlossen", value: summary.completed },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="flex flex-col gap-1 p-4">
          <span className="text-2xl font-semibold leading-tight">{item.value}</span>
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </Card>
      ))}
    </div>
  );
}
