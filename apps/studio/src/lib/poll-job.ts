"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
export interface PollableJob {
  id: string;
  status: string;
  errorMessage?: string | null;
  result?: unknown;
  /** 0–100 completion, when the runner reports it via updateProgress(). */
  progress?: number | null;
  /** Human-readable phase label, when the runner reports it. */
  progressLabel?: string | null;
}

export async function fetchJob(jobId: string): Promise<PollableJob | null> {
  const response = await fetch(studioApiUrl(`/api/jobs/${jobId}`));
  const data = await response.json();
  if (!response.ok) return null;
  return data.job as PollableJob;
}

export async function waitForJob(
  jobId: string,
  options: {
    intervalMs?: number;
    timeoutMs?: number;
    /** Invoked after every poll (including the terminal one) with the latest job
     * snapshot — lets callers surface live progress/progressLabel to the UI. */
    onPoll?: (job: PollableJob) => void;
  } = {},
): Promise<PollableJob> {
  const intervalMs = options.intervalMs ?? 500;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await fetchJob(jobId);
    if (!job) {
      throw new Error("Job nicht gefunden.");
    }

    options.onPoll?.(job);

    if (job.status === "completed") {
      return job;
    }

    if (job.status === "failed" || job.status === "cancelled") {
      throw new Error(job.errorMessage ?? `Job ${job.status}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Zeitüberschreitung beim Warten auf den Job.");
}
