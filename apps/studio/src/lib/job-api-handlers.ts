import { NextResponse } from "next/server";
import {
  createJobService,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  prisma,
  type JobStatus,
  type JobType,
} from "@uwe/database/server";
import { dispatchJob, enqueueAndDispatch, retryAndDispatch } from "./job-executor";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getJobs() {
  return createJobService(prisma);
}

export async function getJobsList(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as JobStatus | null;
  const type = url.searchParams.get("type") as JobType | null;
  const worldSlug = url.searchParams.get("worldSlug") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const jobs = await getJobs().list({
    status: status ?? undefined,
    type: type ?? undefined,
    worldSlug,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  const summary = await getJobs().getSummary();

  return NextResponse.json({
    jobs,
    summary,
    labels: {
      types: JOB_TYPE_LABELS,
      statuses: JOB_STATUS_LABELS,
    },
  });
}

export async function getJobDetail(jobId: string) {
  const job = await getJobs().getById(jobId, true);
  if (!job) {
    return jsonError("Job nicht gefunden.", 404);
  }
  return NextResponse.json({ job });
}

export async function postEnqueueJob(body: {
  type: JobType;
  title: string;
  worldSlug?: string;
  payload?: Record<string, unknown>;
  sync?: boolean;
}) {
  if (!body.type || !body.title) {
    return jsonError("type und title sind erforderlich.");
  }

  if (body.sync) {
    const job = await getJobs().enqueue({
      type: body.type,
      title: body.title,
      worldSlug: body.worldSlug,
      payload: body.payload,
    });
    dispatchJob(job.id);

    // Wait for completion (used in tests / explicit sync mode)
    const deadline = Date.now() + 120_000;
    let current = await getJobs().getById(job.id);
    while (
      current &&
      (current.status === "pending" || current.status === "running") &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      current = await getJobs().getById(job.id);
    }

    return NextResponse.json({ job: current });
  }

  const job = await enqueueAndDispatch({
    type: body.type,
    title: body.title,
    worldSlug: body.worldSlug,
    payload: body.payload,
  });

  return NextResponse.json({ job }, { status: 202 });
}

export async function postRetryJob(jobId: string) {
  try {
    const job = await retryAndDispatch(jobId);
    if (!job) {
      return jsonError("Job nicht gefunden.", 404);
    }
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Retry fehlgeschlagen.");
  }
}

export async function postCancelJob(jobId: string) {
  const job = await getJobs().markCancelled(jobId);
  if (!job) {
    return jsonError("Job nicht gefunden.", 404);
  }
  return NextResponse.json({ job });
}
