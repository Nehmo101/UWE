import { getJobDetail, postCancelJob, postRetryJob } from "../../../../src/lib/job-api-handlers";
import { requireStudioApiAuth } from "../../../../src/lib/studio-api-auth";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { jobId } = await context.params;
  return getJobDetail(jobId);
}

export async function POST(request: Request, context: RouteContext) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { jobId } = await context.params;
  const body = (await request.json()) as { action?: "retry" | "cancel" };

  if (body.action === "retry") {
    return postRetryJob(jobId);
  }

  if (body.action === "cancel") {
    return postCancelJob(jobId);
  }

  return Response.json({ error: "Unbekannte Aktion. Nutze action: retry oder cancel." }, { status: 400 });
}
