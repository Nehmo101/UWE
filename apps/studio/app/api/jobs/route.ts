import { getJobsList, postEnqueueJob } from "../../../src/lib/job-api-handlers";
import type { JobType } from "@uwe/database/server";
import {
  guardStudioMutation,
  parseBody,
  passthroughBodySchema,
  requireStudioApiAuth,
} from "@uwe/security";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  return getJobsList(request);
}

export async function POST(request: Request) {
  const authError = guardStudioMutation(request);
  if (authError) return authError;

  const parsed = await parseBody(request, passthroughBodySchema);
  if (!parsed.success) return parsed.response;

  return postEnqueueJob(parsed.data as {
    type: JobType;
    title: string;
    worldSlug?: string;
    payload?: Record<string, unknown>;
    sync?: boolean;
  });
}
