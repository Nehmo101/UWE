"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";

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

  if (jobs.length === 0) {
    return (
      <p className="uwe-v2-empty">
        Keine Druckjobs in der Warteschlange.{" "}
        <Link href={labelsHref}>RTX-Druck öffnen →</Link>
      </p>
    );
  }

  return (
    <table className="uwe-page-table">
      <thead>
        <tr>
          <th>Job</th>
          <th>Status</th>
          <th>Connector</th>
          <th>Erstellt</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id}>
            <td>{job.title}</td>
            <td>
              <span className="uwe-badge">{job.statusLabel}</span>
            </td>
            <td>{job.connectorName ?? "—"}</td>
            <td>{new Date(job.createdAt).toLocaleString("de-DE")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
