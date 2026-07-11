"use client";

import { useEffect, useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { refreshPrintersAction } from "@/app/label-print-actions";
import {
  Alert,
  Badge,
  type BadgeProps,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/src/components/ui";

interface PrinterRow {
  id: string;
  name: string;
  connectorName: string;
}

interface JobRow {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
}

function jobBadgeVariant(status: string): NonNullable<BadgeProps["variant"]> {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  return "default";
}

interface StatusPayload {
  ok: boolean;
  offlineMessage: string;
  printers: PrinterRow[];
  jobs: JobRow[];
  timestamp: string;
}

interface Props {
  initial: StatusPayload;
  initialError?: string;
  initialRefreshed?: boolean;
}

export function SystemPrintersClient({
  initial,
  initialError,
  initialRefreshed,
}: Props) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState(initialError ?? null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(studioApiUrl("/api/system/printers/status"), {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const payload = (await response.json()) as StatusPayload;
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      } catch {
        // keep last good snapshot
      }
    }

    const interval = window.setInterval(() => void poll(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <>
      {error && <Alert tone="danger" title="Fehler">{decodeURIComponent(error)}</Alert>}
      {initialRefreshed && <Alert tone="success" title="OK">Drucker-Suche gestartet.</Alert>}
      {!data.ok && <Alert tone="warning" title="Offline">{data.offlineMessage}</Alert>}
      <p className="text-sm text-muted-foreground">
        Live-Status · zuletzt aktualisiert {new Date(data.timestamp).toLocaleTimeString("de-DE")}
      </p>
      <Card>
        <CardHeader><CardTitle>Drucker</CardTitle></CardHeader>
        <CardContent>
          <form action={refreshPrintersAction}>
            <input type="hidden" name="returnTo" value="/system/printers" />
            <Button type="submit" disabled={!data.ok}>Suchen</Button>
          </form>
          {data.printers.length === 0 ? (
            <EmptyState
              title="Keine Drucker gefunden"
              description="Drucker erscheinen hier, sobald der RTX-Connector läuft und Drucker meldet."
            />
          ) : (
            <ul className="mt-3 grid gap-2">
              {data.printers.map((printer) => (
                <li
                  key={printer.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
                >
                  <strong>{printer.name}</strong>
                  <span className="text-sm text-muted-foreground">{printer.connectorName}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader><CardTitle>Queue</CardTitle></CardHeader>
        <CardContent>
          {data.jobs.length === 0 ? (
            <EmptyState
              title="Keine Druckaufträge"
              description="Gesendete Drucklisten erscheinen hier mit Status."
            />
          ) : (
            <ul className="grid gap-2">
              {data.jobs.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
                >
                  <strong>{job.title}</strong>
                  <Badge variant={jobBadgeVariant(job.status)}>{job.statusLabel}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
