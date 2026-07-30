"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ResponsiveTable, StatusPill, type StatusTone } from "@uwe/shared-ui";
import { studioApiUrl } from "@/src/lib/studio-api-url";

/**
 * Zeichen und Ton je Job-Status. Beides zusammen, nie die Farbe allein: das
 * Kästchen davor unterschied „läuft" und „fehlgeschlagen" ausschließlich über
 * den Text — bei gleicher, grauer Fläche.
 */
const PRINT_STATUS_GLYPH: Record<string, string> = {
  pending: "◷",
  running: "◐",
  done: "✓",
  failed: "✗",
  cancelled: "⊘",
};

const PRINT_STATUS_TONE: Record<string, StatusTone> = {
  pending: "neutral",
  running: "info",
  done: "success",
  failed: "danger",
  cancelled: "warning",
};

interface PrintJobRow {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  connectorName: string | null;
  createdAt: string;
}

interface Props {
  worldSlug: string;
  initialJobs: PrintJobRow[];
  labelsHref: string;
}

export function PrintQueuePanel({ worldSlug, initialJobs, labelsHref }: Props) {
  const [jobs, setJobs] = useState(initialJobs);

  const refresh = useCallback(async () => {
    const response = await fetch(studioApiUrl(`/api/worlds/${worldSlug}/print-queue`));
    if (!response.ok) return;
    const data = (await response.json()) as { jobs: PrintJobRow[] };
    setJobs(data.jobs ?? []);
  }, [worldSlug]);

  useEffect(() => {
    const hasActive = jobs.some((job) => job.status === "pending" || job.status === "running");
    if (!hasActive) return;

    const timer = setInterval(() => {
      void refresh();
    }, 5000);

    return () => clearInterval(timer);
  }, [jobs, refresh]);

  return (
    <ResponsiveTable
      caption="Druck-Warteschlange"
      rowKey={(job) => job.id}
      rows={jobs}
      columns={[
        { key: "job", label: "Job", primary: true, render: (job) => job.title },
        {
          key: "status",
          // Der Status stand als farbloses Kästchen da. Als StatusPill trägt
          // er ein Zeichen mit — dieselbe Auskunft ohne Verlass auf Farbe.
          label: "Status",
          render: (job) => (
            <StatusPill glyph={PRINT_STATUS_GLYPH[job.status] ?? "•"} tone={PRINT_STATUS_TONE[job.status] ?? "neutral"}>
              {job.statusLabel}
            </StatusPill>
          ),
        },
        { key: "connector", label: "Connector", render: (job) => job.connectorName ?? "—" },
        {
          key: "created",
          label: "Erstellt",
          priority: "low",
          render: (job) => new Date(job.createdAt).toLocaleString("de-DE"),
        },
      ]}
      empty={
        <p className="text-sm text-muted-foreground">
          Keine Druckjobs in der Warteschlange.{" "}
          <Link href={labelsHref}>RTX-Druck öffnen →</Link>
        </p>
      }
    />
  );
}
