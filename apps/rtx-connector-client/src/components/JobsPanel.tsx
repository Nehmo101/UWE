import { useCallback, useEffect, useState } from "react";

import { ButtonV2, CardV2, HealthBadge } from "@uwe/shared-ui";

import type { ConnectorJobHistoryEntry } from "../lib/tauri";

type Props = {
  onLoadJobs: () => Promise<ConnectorJobHistoryEntry[]>;
};

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

function formatDuration(durationMs: number): string {
  if (durationMs >= 1_000) {
    return `${(durationMs / 1_000).toFixed(1)} s`;
  }

  return `${durationMs} ms`;
}

export function JobsPanel({ onLoadJobs }: Props) {
  const [jobs, setJobs] = useState<ConnectorJobHistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      setJobs(await onLoadJobs());
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }, [onLoadJobs]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  return (
    <CardV2
      title="Letzte Connector-Jobs"
      footer={
        <div className="connector-actions">
          <ButtonV2 variant="ghost" onClick={loadJobs} disabled={busy}>
            Neu laden
          </ButtonV2>
        </div>
      }
    >
      <div className="connector-stack">
        <p className="connector-muted">
          Privacy-safe Historie: nur Job-ID, Lane, Status, Dauer und ggf. gekürzter Fehlergrund.
        </p>

        {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}

        {jobs.length === 0 ? (
          <div className="connector-empty-state">Noch keine lokalen Jobs aufgezeichnet.</div>
        ) : (
          <div className="connector-table-wrap">
            <table className="connector-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Lane</th>
                  <th>Status</th>
                  <th>Dauer</th>
                  <th>Fertig</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <div className="connector-table-primary">{job.type}</div>
                      <div className="connector-table-secondary">{job.id}</div>
                      {job.reason ? <div className="connector-table-secondary">{job.reason}</div> : null}
                    </td>
                    <td>{job.lane}</td>
                    <td>
                      <HealthBadge
                        status={job.status === "completed" ? "ok" : "error"}
                        label={job.status === "completed" ? "completed" : "failed"}
                      />
                    </td>
                    <td>{formatDuration(job.durationMs)}</td>
                    <td>{job.finishedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CardV2>
  );
}
