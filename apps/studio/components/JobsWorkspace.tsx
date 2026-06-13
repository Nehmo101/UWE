"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function statusClass(status: string): string {
  switch (status) {
    case "completed":
      return "uwe-badge uwe-badge-published";
    case "running":
      return "uwe-badge uwe-badge-player";
    case "failed":
      return "uwe-badge uwe-badge-secret";
    case "cancelled":
      return "uwe-badge uwe-badge-draft";
    default:
      return "uwe-badge";
  }
}

async function pollJob(jobId: string): Promise<JobItem | null> {
  const response = await fetch(`/api/jobs/${jobId}`);
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

    const response = await fetch(`/api/jobs?${params.toString()}`);
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
      const response = await fetch(`/api/jobs/${jobId}`, {
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
      const response = await fetch(`/api/jobs/${jobId}`, {
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
    <div className="uwe-jobs-workspace">
      <StatGrid summary={summary} />

      {error && (
        <p className="uwe-form-error" role="alert">
          {error}
        </p>
      )}

      <div className="uwe-jobs-toolbar">
        <label>
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Alle</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="uwe-btn uwe-btn-secondary" onClick={() => void refresh()}>
          Aktualisieren
        </button>
      </div>

      <div className="uwe-jobs-layout">
        <div className="uwe-jobs-list">
          {jobs.length === 0 ? (
            <p className="uwe-dashboard-muted">Keine Jobs vorhanden.</p>
          ) : (
            jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                className={`uwe-jobs-list-item${selectedId === job.id ? " is-active" : ""}`}
                onClick={() => void loadDetail(job.id)}
              >
                <div className="uwe-jobs-list-item-header">
                  <strong>{job.title}</strong>
                  <span className={statusClass(job.status)}>{statusLabels[job.status] ?? job.status}</span>
                </div>
                <div className="uwe-jobs-list-item-meta">
                  <span>{typeLabels[job.type] ?? job.type}</span>
                  <span>{DATE_FORMAT.format(new Date(job.createdAt))}</span>
                </div>
                {job.progress != null && job.status === "running" && (
                  <div className="uwe-jobs-progress">
                    <div className="uwe-jobs-progress-bar" style={{ width: `${job.progress}%` }} />
                    <span>{job.progressLabel ?? `${job.progress}%`}</span>
                  </div>
                )}
                {job.errorMessage && (
                  <p className="uwe-jobs-error-preview">{job.errorMessage}</p>
                )}
              </button>
            ))
          )}
        </div>

        <div className="uwe-jobs-detail">
          {selectedJob ? (
            <>
              <header className="uwe-jobs-detail-header">
                <div>
                  <h2>{selectedJob.title}</h2>
                  <p className="uwe-dashboard-muted">
                    {typeLabels[selectedJob.type] ?? selectedJob.type} ·{" "}
                    {statusLabels[selectedJob.status] ?? selectedJob.status}
                    {selectedJob.worldSlug ? ` · Welt ${selectedJob.worldSlug}` : ""}
                  </p>
                </div>
                <div className="uwe-jobs-detail-actions">
                  {selectedJob.canCancel && (
                    <button
                      type="button"
                      className="uwe-btn uwe-btn-secondary"
                      disabled={busy === selectedJob.id}
                      onClick={() => void cancelJob(selectedJob.id)}
                    >
                      Abbrechen
                    </button>
                  )}
                  {selectedJob.canRetry && (
                    <button
                      type="button"
                      className="uwe-btn"
                      disabled={busy === selectedJob.id}
                      onClick={() => void retryJob(selectedJob.id)}
                    >
                      Erneut versuchen
                    </button>
                  )}
                </div>
              </header>

              {selectedJob.errorMessage && (
                <div className="uwe-form-error" role="alert">
                  <strong>Fehler:</strong> {selectedJob.errorMessage}
                </div>
              )}

              <p className="uwe-dashboard-muted">
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

              <section>
                <h3>Protokoll</h3>
                {selectedJob.logs && selectedJob.logs.length > 0 ? (
                  <ul className="uwe-jobs-log-list">
                    {selectedJob.logs.map((log) => (
                      <li key={log.id} data-level={log.level}>
                        <time>{DATE_FORMAT.format(new Date(log.createdAt))}</time>
                        <span>{log.message}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="uwe-dashboard-muted">Noch keine Log-Einträge.</p>
                )}
              </section>
            </>
          ) : (
            <p className="uwe-dashboard-muted">Wähle einen Job aus der Liste.</p>
          )}
        </div>
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
    <div className="uwe-stat-grid" style={{ marginBottom: "1rem" }}>
      {items.map((item) => (
        <div key={item.label} className="uwe-stat-card">
          <span className="uwe-stat-value">{item.value}</span>
          <span className="uwe-stat-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
