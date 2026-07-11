"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { Badge } from "@/src/components/ui";

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={TH_CLASS}>Job</th>
            <th className={TH_CLASS}>Status</th>
            <th className={TH_CLASS}>Drucker</th>
            <th className={TH_CLASS}>Connector</th>
            <th className={TH_CLASS}>Erstellt</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className={TD_CLASS}>{job.title}</td>
              <td className={TD_CLASS}>
                <Badge variant={job.phase === "failed" ? "danger" : job.phase === "done" ? "success" : "default"}>
                  {job.phaseLabel}
                </Badge>
                {job.failedReason ? <p className="text-sm text-warning">{job.failedReason}</p> : null}
              </td>
              <td className={TD_CLASS}>{job.printerName ?? "—"}</td>
              <td className={TD_CLASS}>{job.connectorName ?? "—"}</td>
              <td className={TD_CLASS}>{new Date(job.createdAt).toLocaleString("de-DE")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
