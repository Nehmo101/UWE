"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";

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
      <p className="uwe-table-sub">
        Noch keine RTX-Jobs für diese Liste.{" "}
        <Link href={printCenterHref}>Print Center →</Link>
      </p>
    );
  }

  return (
    <table className="uwe-page-table">
      <thead>
        <tr>
          <th>Job</th>
          <th>Status</th>
          <th>Drucker</th>
          <th>Connector</th>
          <th>Erstellt</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id}>
            <td>{job.title}</td>
            <td>
              <span className={`uwe-badge${job.phase === "failed" ? " uwe-badge-danger" : job.phase === "done" ? " uwe-badge-player" : ""}`}>
                {job.phaseLabel}
              </span>
              {job.failedReason ? <p className="uwe-table-sub uwe-text-warning">{job.failedReason}</p> : null}
            </td>
            <td>{job.printerName ?? "—"}</td>
            <td>{job.connectorName ?? "—"}</td>
            <td>{new Date(job.createdAt).toLocaleString("de-DE")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
