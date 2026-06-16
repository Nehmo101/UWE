import {
  createJobService,
  logAuditEvent,
  prisma,
  type EnqueueJobInput,
  type JobView,
} from "@uwe/database/server";
import { executeJobRunners } from "./job-runners";

const activeJobs = new Set<string>();

function getJobs() {
  return createJobService(prisma);
}

export function dispatchJob(jobId: string): void {
  if (activeJobs.has(jobId)) {
    return;
  }

  activeJobs.add(jobId);
  void runJob(jobId).finally(() => {
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
