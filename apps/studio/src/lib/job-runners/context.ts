import type { JobService, JobView } from "@uwe/database/server";

export interface JobRunnerContext {
  jobs: JobService;
  jobId: string;
  job: JobView;
}

export async function assertNotCancelled(jobs: JobService, jobId: string): Promise<void> {
  if (await jobs.isCancelled(jobId)) {
    throw new Error("Job wurde abgebrochen.");
  }
}
