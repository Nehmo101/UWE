"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface HostUpdateAvailability {
  enabled: boolean;
  available: boolean;
  reason: string | null;
  repoPath: string;
  triggerScript: string | null;
  logPath: string;
  statePath: string;
}

interface HostUpdateState {
  jobId: string | null;
  status: "idle" | "pending" | "running" | "succeeded" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  startedByUserId: string | null;
  exitCode: number | null;
  commitBefore: string | null;
  commitAfter: string | null;
  error: string | null;
}

interface HostGitInfo {
  repoPath: string;
  branch: string | null;
  commit: string | null;
  shortCommit: string | null;
  dirty: boolean;
  behindRemote: number | null;
  remoteDefaultRef: string | null;
}

interface HostUpdateDashboard {
  availability: HostUpdateAvailability;
  state: HostUpdateState;
  git: HostGitInfo | null;
  logTail: string | null;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function statusLabel(status: HostUpdateState["status"]): string {
  switch (status) {
    case "pending":
      return "Wartet…";
    case "running":
      return "Läuft…";
    case "succeeded":
      return "Erfolgreich";
    case "failed":
      return "Fehlgeschlagen";
    default:
      return "Bereit";
  }
}

interface Props {
  canTrigger: boolean;
}

export function HostUpdatePanel({ canTrigger }: Props) {
  const [dashboard, setDashboard] = useState<HostUpdateDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadDashboard = useCallback(async (fetchRemote = false) => {
    setError(null);
    try {
      const query = fetchRemote ? "?fetchRemote=1" : "";
      const response = await fetch(studioApiUrl(`/api/admin/host-update${query}`));
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? `Status ${response.status}`);
      }
      const payload = (await response.json()) as HostUpdateDashboard;
      setDashboard(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Status konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(true);
  }, [loadDashboard]);

  const isActive =
    dashboard?.state.status === "pending" || dashboard?.state.status === "running";

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void loadDashboard(false);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [isActive, loadDashboard]);

  async function handleTrigger() {
    setTriggering(true);
    setError(null);
    setConfirmOpen(false);

    try {
      const response = await fetch(studioApiUrl("/api/admin/host-update"), { method: "POST" });
      const payload = (await response.json()) as { error?: string; jobId?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Status ${response.status}`);
      }
      await loadDashboard(false);
    } catch (triggerError) {
      setError(
        triggerError instanceof Error ? triggerError.message : "Host-Update konnte nicht gestartet werden.",
      );
    } finally {
      setTriggering(false);
    }
  }

  if (loading && !dashboard) {
    return (
      <section className="uwe-v2-section uwe-v2-card">
        <h2 className="uwe-v2-section-title">UWE Host-Update</h2>
        <p className="uwe-dashboard-muted">Status wird geladen…</p>
      </section>
    );
  }

  const availability = dashboard?.availability;
  const state = dashboard?.state;
  const git = dashboard?.git;

  return (
    <section className="uwe-v2-section uwe-v2-card uwe-homelab-host-update">
      <h2 className="uwe-v2-section-title">UWE Host-Update</h2>
      <p className="uwe-dashboard-muted">
        Führt <code>git pull</code> und <code>setup-uwe-host.sh --quick</code> auf diesem Linux-Host aus.
        Studio ist während des Updates einige Minuten nicht erreichbar.
      </p>

      {error && (
        <p className="uwe-form-error" role="alert">
          {error}
        </p>
      )}

      <dl className="uwe-homelab-device-meta">
        <div>
          <dt>Aktivierung</dt>
          <dd>{availability?.enabled ? "UWE_HOST_UPDATE_ENABLED=true" : "deaktiviert"}</dd>
        </div>
        <div>
          <dt>Verfügbarkeit</dt>
          <dd>{availability?.available ? "bereit" : availability?.reason ?? "—"}</dd>
        </div>
        <div>
          <dt>Repository</dt>
          <dd>
            <code>{availability?.repoPath ?? "—"}</code>
          </dd>
        </div>
        <div>
          <dt>Git-Branch</dt>
          <dd>{git?.branch ?? "—"}</dd>
        </div>
        <div>
          <dt>Commit</dt>
          <dd>
            {git?.shortCommit ? (
              <code title={git.commit ?? undefined}>{git.shortCommit}</code>
            ) : (
              "—"
            )}
            {git?.dirty ? " (lokale Änderungen)" : ""}
          </dd>
        </div>
        <div>
          <dt>Remote</dt>
          <dd>
            {git?.behindRemote != null && git.behindRemote > 0
              ? `${git.behindRemote} Commit(s) hinter ${git.remoteDefaultRef ?? "Upstream"}`
              : git?.behindRemote === 0
                ? "aktuell"
                : "—"}
          </dd>
        </div>
        <div>
          <dt>Letzter Lauf</dt>
          <dd>
            {state?.status && state.status !== "idle"
              ? `${statusLabel(state.status)}${
                  state.finishedAt
                    ? ` · ${DATE_FORMAT.format(new Date(state.finishedAt))}`
                    : state.startedAt
                      ? ` · gestartet ${DATE_FORMAT.format(new Date(state.startedAt))}`
                      : ""
                }`
              : "noch keins"}
          </dd>
        </div>
      </dl>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", marginTop: "1rem" }}>
        {canTrigger ? (
          <>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-primary"
              disabled={
                !availability?.available || triggering || isActive
              }
              onClick={() => setConfirmOpen(true)}
            >
              {triggering || isActive ? "Update läuft…" : "UWE aktualisieren"}
            </button>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-ghost"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                void loadDashboard(true);
              }}
            >
              Status aktualisieren
            </button>
          </>
        ) : (
          <p className="uwe-dashboard-muted">Nur der Owner kann Host-Updates auslösen.</p>
        )}
        <Link className="uwe-v2-btn uwe-v2-btn-ghost" href="/backup">
          Backup vor Update
        </Link>
        <Link className="uwe-v2-btn uwe-v2-btn-ghost" href="/admin/audit-log">
          Audit-Log
        </Link>
      </div>

      {confirmOpen && (
        <div className="uwe-form-error" role="dialog" aria-labelledby="host-update-confirm-title">
          <p id="host-update-confirm-title">
            <strong>Host-Update starten?</strong> Das zieht den neuesten Code und baut UWE neu. Der
            Dienst wird neu gestartet.
          </p>
          <div style={{ display: "flex", gap: "0.65rem", marginTop: "0.75rem" }}>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-primary"
              disabled={triggering}
              onClick={() => void handleTrigger()}
            >
              Ja, jetzt aktualisieren
            </button>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-ghost"
              onClick={() => setConfirmOpen(false)}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {isActive && (
        <p className="uwe-notice" style={{ marginTop: "1rem" }} role="status">
          Update läuft — diese Seite aktualisiert den Status automatisch. Bei Verbindungsabbruch
          einfach später erneut öffnen.
        </p>
      )}

      {state?.error && state.status === "failed" && (
        <p className="uwe-form-error" role="alert">
          {state.error}
        </p>
      )}

      {dashboard?.logTail && (
        <details style={{ marginTop: "1rem" }}>
          <summary>Update-Log (Auszug)</summary>
          <pre className="uwe-homelab-command" style={{ whiteSpace: "pre-wrap", maxHeight: "16rem", overflow: "auto" }}>
            {dashboard.logTail}
          </pre>
          {availability?.logPath ? (
            <p className="uwe-dashboard-muted">
              Vollständiges Log auf dem Host: <code>{availability.logPath}</code>
            </p>
          ) : null}
        </details>
      )}
    </section>
  );
}
