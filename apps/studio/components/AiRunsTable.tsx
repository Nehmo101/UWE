"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatStudioDate } from "@/src/lib/format";

export interface AiRunRow {
  id: string;
  taskType: string;
  status: string;
  provider: string;
  model: string;
  pageTitle: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface Props {
  worldSlug: string;
  initialRuns: AiRunRow[];
  taskLabels: Record<string, string>;
  statusLabels: Record<string, string>;
}

export function AiRunsTable({ worldSlug, initialRuns, taskLabels, statusLabels }: Props) {
  const [runs, setRuns] = useState(initialRuns);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ worldSlug, limit: "100" });
    const response = await fetch(studioApiUrl(`/api/ai/runs?${params.toString()}`));
    const data = await response.json();
    if (response.ok) {
      setRuns((data.runs as AiRunRow[]) ?? []);
    }
  }, [worldSlug]);

  useEffect(() => {
    const hasActive = runs.some((run) => run.status === "pending" || run.status === "running");
    if (!hasActive) return;

    const timer = setInterval(() => {
      void refresh();
    }, 2500);

    return () => clearInterval(timer);
  }, [runs, refresh]);

  if (runs.length === 0) {
    return <p className="uwe-v2-empty">Noch keine AI Runs für diese Welt.</p>;
  }

  return (
    <table className="uwe-page-table">
      <thead>
        <tr>
          <th>Zeit</th>
          <th>Aufgabe</th>
          <th>Status</th>
          <th>Provider / Modell</th>
          <th>Seite</th>
          <th>Dauer</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.id}>
            <td>{formatStudioDate(new Date(run.createdAt), "short")}</td>
            <td>{taskLabels[run.taskType] ?? run.taskType}</td>
            <td>{statusLabels[run.status] ?? run.status}</td>
            <td>
              {run.provider}
              <br />
              <span className="uwe-meta">{run.model}</span>
            </td>
            <td>{run.pageTitle ?? "—"}</td>
            <td>{run.durationMs != null ? `${run.durationMs} ms` : "—"}</td>
            <td>
              <Link href={`/worlds/${worldSlug}/ai-runs/${run.id}`}>Details</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
