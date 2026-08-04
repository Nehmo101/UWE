import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import {
  getBrainRunById,
  postApplyProposal,
  postDiscardRun,
} from "../../../../../src/lib/brain-handlers";
import { brainRunActionBodySchema, idSchema, parseBody, parseParams } from "@uwe/security";
import { z } from "zod";

const runIdParamSchema = z.object({ runId: idSchema });

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, runIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  return getBrainRunById(parsedParams.data.runId);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const authError = await guardStudioApiRequest(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, runIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, brainRunActionBodySchema);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;

  if (body.action === "discard") {
    return postDiscardRun(parsedParams.data.runId);
  }

  return postApplyProposal({
    runId: parsedParams.data.runId,
    proposalId: body.proposalId,
    editedContent: body.editedContent,
    ideaTitle: body.ideaTitle,
  });
}
