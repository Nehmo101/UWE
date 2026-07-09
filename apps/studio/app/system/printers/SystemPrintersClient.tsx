"use client";

import { useEffect, useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { refreshPrintersAction } from "@/app/label-print-actions";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/src/components/ui";

interface PrinterRow {
  id: string;
  name: string;
  connectorName: string;
}

interface JobRow {
  id: string;
  title: string;
  statusLabel: string;
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
  const [error] = useState(initialError ?? null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(studioApiUrl("/api/system/printers/status"), {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const payload = (await response.json()) as StatusPayload;
        if (!cancelled) setData(payload);
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
      <p className="uwe-dashboard-muted">
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
            <EmptyState title="Keine Drucker" />
          ) : (
            data.printers.map((printer) => (
              <p key={printer.id}>
                {printer.name} ({printer.connectorName})
              </p>
            ))
          )}
        </CardContent>
      </Card>
      <Card style={{ marginTop: "1rem" }}>
        <CardHeader><CardTitle>Queue</CardTitle></CardHeader>
        <CardContent>
          {data.jobs.length === 0 ? (
            <EmptyState title="Leer" />
          ) : (
            data.jobs.map((job) => (
              <p key={job.id}>
                {job.title} — {job.statusLabel}
              </p>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
