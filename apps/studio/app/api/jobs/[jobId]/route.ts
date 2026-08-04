import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getJobDetail, postCancelJob, postRetryJob } from "../../../../src/lib/job-api-handlers";
import { idSchema, parseBody, parseParams } from "@uwe/security";
import { z } from "zod";

const jobIdParamSchema = z.object({ jobId: idSchema });

const jobActionBodySchema = z.object({
  action: z.enum(["retry", "cancel"]),
});

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, jobIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  return getJobDetail(parsedParams.data.jobId);
}

export async function POST(request: Request, context: RouteContext) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, jobIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, jobActionBodySchema);
  if (!parsed.success) return parsed.response;

  if (parsed.data.action === "retry") {
    return postRetryJob(parsedParams.data.jobId);
  }

  return postCancelJob(parsedParams.data.jobId);
}
