import {
  createJobService,
  logAuditEvent,
  prisma,
  type EnqueueJobInput,
  type JobView,
} from "@uwe/database/server";
import { executeJobRunners } from "./job-runners";

const activeJobs = new Set<string>();

let recoveryDone = false;

function getJobs() {
  return createJobService(prisma);
}

/**
 * Boot-time sweep for the in-memory job runner: fail jobs orphaned by a process
 * restart (left in "running") so they become retryable, and re-dispatch jobs still
 * "pending" through the normal path so they resume. Safe to call from
 * instrumentation — it runs at most once per process and never throws.
 */
export async function recoverInterruptedJobsAtBoot(): Promise<void> {
  if (recoveryDone) {
    return;
  }
  recoveryDone = true;

  try {
    const { failedRunning, pendingToDispatch } = await getJobs().recoverInterruptedJobs();

    if (failedRunning.length > 0) {
      console.warn(
        `[uwe/job-executor] Boot-Recovery: ${failedRunning.length} unterbrochene(r) Job(s) als fehlgeschlagen markiert`,
      );
    }

    for (const job of pendingToDispatch) {
      dispatchJob(job.id);
    }

    if (pendingToDispatch.length > 0) {
      console.info(
        `[uwe/job-executor] Boot-Recovery: ${pendingToDispatch.length} wartende(r) Job(s) erneut eingereiht`,
      );
    }
  } catch (error) {
    // Recovery is best-effort and must never crash boot.
    console.error("[uwe/job-executor] Boot-Recovery fehlgeschlagen", error);
  }
}

export function dispatchJob(jobId: string): void {
  if (activeJobs.has(jobId)) {
    return;
  }

  activeJobs.add(jobId);
  void runJob(jobId)
    .catch((error) => {
      // runJob's internal try/catch only covers the runner execution; if the
      // surrounding job-store calls (getById/markRunning/isCancelled/markFailed)
      // throw — e.g. the DB is unreachable — the rejection would be unhandled and
      // crash the process. This dispatch is fire-and-forget, so swallow + log.
      console.error("[uwe/job-executor] dispatched job crashed", jobId, error);
    })
    .finally(() => {
      activeJobs.delete(jobId);
    });
}

export async function enqueueAndDispatch(input: EnqueueJobInput): Promise<JobView> {
  const job = await getJobs().enqueue(input);
  dispatchJob(job.id);
  return job;
}

export async function runJob(jobId: string): Promise<JobView | null> {
  const jobs = getJobs();
  const job = await jobs.getById(jobId);
  if (!job) {
    return null;
  }

  if (job.status !== "pending") {
    return job;
  }

  const running = await jobs.markRunning(jobId);
  if (!running || running.status !== "running") {
    return running;
  }

  try {
    const result = await executeJobRunners({
      jobs,
      jobId,
      job: running,
    });

    if (await jobs.isCancelled(jobId)) {
      return jobs.getById(jobId);
    }

    return jobs.markCompleted(jobId, result);
  } catch (error) {
    if (await jobs.isCancelled(jobId)) {
      return jobs.getById(jobId);
    }

    const message = error instanceof Error ? error.message : "Job fehlgeschlagen.";
    const details =
      error instanceof Error
        ? { name: error.name, stack: error.stack?.split("\n").slice(0, 5) }
        : undefined;

    if (running.type === "import") {
      const payload = (running.payload ?? {}) as { worldSlug?: string; format?: string };
      const world = payload.worldSlug
        ? await prisma.world.findUnique({ where: { slug: payload.worldSlug } })
        : null;

      await logAuditEvent(prisma, {
        action: "import_failed",
        targetType: "import",
        targetId: jobId,
        worldId: world?.id,
        metadata: { format: payload.format, error: message },
      });
    }

    return jobs.markFailed(jobId, message, details);
  }
}

export async function retryAndDispatch(jobId: string): Promise<JobView | null> {
  const jobs = getJobs();
  const retried = await jobs.retry(jobId);
  if (retried) {
    dispatchJob(jobId);
  }
  return retried;
}
