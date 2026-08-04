import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getJobsList, postEnqueueJob } from "../../../src/lib/job-api-handlers";
import { jobEnqueueBodySchema, parseBody } from "@uwe/security";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  return getJobsList(request);
}

export async function POST(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = await parseBody(request, jobEnqueueBodySchema);
  if (!parsed.success) return parsed.response;

  return postEnqueueJob(parsed.data);
}
