"use client";

import { ResponsiveTable } from "@uwe/shared-ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { Badge } from "@/src/components/ui";


interface PrintListJobRow {
  id: string;
  title: string;
  phase: "queued" | "printing" | "done" | "failed";
  phaseLabel: string;
  connectorName: string | null;
  printerName: string | null;
  failedReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface Props {
  worldSlug: string;
  printListId: string;
  initialJobs: PrintListJobRow[];
  printCenterHref: string;
}

const ACTIVE_PHASES = new Set<PrintListJobRow["phase"]>(["queued", "printing"]);

export function PrintListJobPanel({ worldSlug, printListId, initialJobs, printCenterHref }: Props) {
  const [jobs, setJobs] = useState(initialJobs);

  const refresh = useCallback(async () => {
    const response = await fetch(
      studioApiUrl(`/api/worlds/${worldSlug}/print-lists/${printListId}/print-queue`),
    );
    if (!response.ok) return;
    const data = (await response.json()) as { jobs: PrintListJobRow[] };
    setJobs(data.jobs ?? []);
  }, [worldSlug, printListId]);

  useEffect(() => {
    const hasActive = jobs.some((job) => ACTIVE_PHASES.has(job.phase));
    if (!hasActive) return;
    const timer = setInterval(() => { void refresh(); }, 5000);
    return () => clearInterval(timer);
  }, [jobs, refresh]);

  if (jobs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine RTX-Jobs für diese Liste.{" "}
        <Link href={printCenterHref}>Print Center →</Link>
      </p>
    );
  }

  return (
    <ResponsiveTable
      caption="Druckjobs dieser Liste"
      rowKey={(job) => job.id}
      rows={jobs}
      columns={[
        { key: "job", label: "Job", primary: true, render: (job) => job.title },
        {
          key: "status",
          label: "Status",
          render: (job) => (
            <>
              <Badge
                variant={
                  job.phase === "failed" ? "danger" : job.phase === "done" ? "success" : "default"
                }
              >
                {job.phaseLabel}
              </Badge>
              {job.failedReason ? <p className="text-sm text-warning">{job.failedReason}</p> : null}
            </>
          ),
        },
        { key: "printer", label: "Drucker", render: (job) => job.printerName ?? "—" },
        { key: "connector", label: "Connector", render: (job) => job.connectorName ?? "—" },
        {
          key: "created",
          label: "Erstellt",
          priority: "low",
          render: (job) => new Date(job.createdAt).toLocaleString("de-DE"),
        },
      ]}
    />
  );
}
