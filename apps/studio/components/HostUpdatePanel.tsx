"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, buttonVariants } from "@/src/components/ui";

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

const DT_CLASS = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
const DD_CLASS = "text-sm";

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
      <Card>
        <CardHeader>
          <CardTitle>UWE Host-Update</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Status wird geladen…</p>
        </CardContent>
      </Card>
    );
  }

  const availability = dashboard?.availability;
  const state = dashboard?.state;
  const git = dashboard?.git;

  return (
    <Card>
      <CardHeader>
        <CardTitle>UWE Host-Update</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Führt <code>git pull</code> und <code>setup-uwe-host.sh --quick</code> auf diesem Linux-Host aus.
          Studio ist während des Updates einige Minuten nicht erreichbar.
        </p>

        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className={DT_CLASS}>Aktivierung</dt>
            <dd className={DD_CLASS}>{availability?.enabled ? "UWE_HOST_UPDATE_ENABLED=true" : "deaktiviert"}</dd>
          </div>
          <div>
            <dt className={DT_CLASS}>Verfügbarkeit</dt>
            <dd className={DD_CLASS}>{availability?.available ? "bereit" : availability?.reason ?? "—"}</dd>
          </div>
          <div>
            <dt className={DT_CLASS}>Repository</dt>
            <dd className={DD_CLASS}>
              <code>{availability?.repoPath ?? "—"}</code>
            </dd>
          </div>
          <div>
            <dt className={DT_CLASS}>Git-Branch</dt>
            <dd className={DD_CLASS}>{git?.branch ?? "—"}</dd>
          </div>
          <div>
            <dt className={DT_CLASS}>Commit</dt>
            <dd className={DD_CLASS}>
              {git?.shortCommit ? (
                <code title={git.commit ?? undefined}>{git.shortCommit}</code>
              ) : (
                "—"
              )}
              {git?.dirty ? " (lokale Änderungen)" : ""}
            </dd>
          </div>
          <div>
            <dt className={DT_CLASS}>Remote</dt>
            <dd className={DD_CLASS}>
              {git?.behindRemote != null && git.behindRemote > 0
                ? `${git.behindRemote} Commit(s) hinter ${git.remoteDefaultRef ?? "Upstream"}`
                : git?.behindRemote === 0
                  ? "aktuell"
                  : "—"}
            </dd>
          </div>
          <div>
            <dt className={DT_CLASS}>Letzter Lauf</dt>
            <dd className={DD_CLASS}>
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

        <div className="flex flex-wrap items-center gap-2">
          {canTrigger ? (
            <>
              <Button
                type="button"
                variant="destructive"
                disabled={!availability?.available || triggering || isActive}
                onClick={() => setConfirmOpen(true)}
              >
                {triggering || isActive ? "Update läuft…" : "UWE aktualisieren"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  void loadDashboard(true);
                }}
              >
                Status aktualisieren
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nur der Owner kann Host-Updates auslösen.</p>
          )}
          <Link href="/backup" className={buttonVariants({ variant: "ghost" })}>
            Backup vor Update
          </Link>
          <Link href="/admin/audit-log" className={buttonVariants({ variant: "ghost" })}>
            Audit-Log
          </Link>
        </div>

        {confirmOpen && (
          <div
            className="flex flex-col gap-3 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 p-4"
            role="dialog"
            aria-labelledby="host-update-confirm-title"
          >
            <p id="host-update-confirm-title" className="text-sm">
              <strong>Host-Update starten?</strong> Das zieht den neuesten Code und baut UWE neu. Der
              Dienst wird neu gestartet.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="destructive" disabled={triggering} onClick={() => void handleTrigger()}>
                Ja, jetzt aktualisieren
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {isActive && (
          <Alert tone="info" role="status">
            Update läuft — diese Seite aktualisiert den Status automatisch. Bei Verbindungsabbruch
            einfach später erneut öffnen.
          </Alert>
        )}

        {state?.error && state.status === "failed" && (
          <Alert tone="danger" role="alert">
            {state.error}
          </Alert>
        )}

        {dashboard?.logTail && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">Update-Log (Auszug)</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-muted p-3 text-xs">
              {dashboard.logTail}
            </pre>
            {availability?.logPath ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Vollständiges Log auf dem Host: <code>{availability.logPath}</code>
              </p>
            ) : null}
          </details>
        )}
      </CardContent>
    </Card>
  );
}
