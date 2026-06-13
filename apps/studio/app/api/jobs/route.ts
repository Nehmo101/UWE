import { getJobsList, postEnqueueJob } from "../../../src/lib/job-api-handlers";
import { requireStudioApiAuth } from "../../../src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  return getJobsList(request);
}

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const body = await request.json();
  return postEnqueueJob(body);
}
