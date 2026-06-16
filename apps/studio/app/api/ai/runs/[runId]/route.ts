import { getRun, patchRun } from "../../../../../src/lib/ai-handlers";
import {
  guardStudioMutation,
  idSchema,
  parseBody,
  parseParams,
  requireStudioApiAuth,
} from "@uwe/security";
import { z } from "zod";

const runIdParamSchema = z.object({ runId: idSchema });

const aiRunPatchBodySchema = z.object({
  status: z.enum(["applied", "discarded", "cancelled"]),
});

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, runIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  return getRun(parsedParams.data.runId);
}

export async function PATCH(request: Request, context: RouteContext) {
  const authError = guardStudioMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, runIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, aiRunPatchBodySchema);
  if (!parsed.success) return parsed.response;

  return patchRun(parsedParams.data.runId, parsed.data);
}
