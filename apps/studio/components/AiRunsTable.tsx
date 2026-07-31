"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ResponsiveTable } from "@uwe/shared-ui";
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

  return (
    <ResponsiveTable
      caption="KI-Läufe"
      rowKey={(run) => run.id}
      rows={runs}
      columns={[
        {
          key: "task",
          label: "Aufgabe",
          primary: true,
          render: (run) => taskLabels[run.taskType] ?? run.taskType,
        },
        {
          key: "status",
          label: "Status",
          render: (run) => statusLabels[run.status] ?? run.status,
        },
        {
          key: "time",
          label: "Zeit",
          render: (run) => formatStudioDate(new Date(run.createdAt), "short"),
        },
        {
          key: "model",
          label: "Provider / Modell",
          render: (run) => (
            <>
              {run.provider}
              <br />
              <span className="text-xs text-muted-foreground">{run.model}</span>
            </>
          ),
        },
        { key: "page", label: "Seite", priority: "low", render: (run) => run.pageTitle ?? "—" },
        {
          key: "duration",
          label: "Dauer",
          numeric: true,
          render: (run) => (run.durationMs != null ? `${run.durationMs} ms` : "—"),
        },
        {
          key: "details",
          label: "Details",
          render: (run) => (
            <Link href={`/worlds/${worldSlug}/ai-runs/${run.id}`}>Details</Link>
          ),
        },
      ]}
      empty={
        <p className="text-sm text-muted-foreground">Noch keine AI Runs für diese Welt.</p>
      }
    />
  );
}
