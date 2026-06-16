import {
  getBrainRunById,
  postApplyProposal,
  postDiscardRun,
} from "../../../../../src/lib/brain-handlers";
import {
  guardStudioMutation,
  idSchema,
  parseBody,
  parseParams,
  passthroughBodySchema,
  requireStudioApiAuth,
} from "@uwe/security";
import { z } from "zod";

const runIdParamSchema = z.object({ runId: idSchema });

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, runIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  return getBrainRunById(parsedParams.data.runId);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const authError = guardStudioMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, runIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, passthroughBodySchema);
  if (!parsed.success) return parsed.response;

  const body = parsed.data as {
    action?: string;
    proposalId?: string;
    editedContent?: string;
    ideaTitle?: string;
  };

  if (body.action === "discard") {
    return postDiscardRun(parsedParams.data.runId);
  }

  if (body.action === "apply") {
    if (!body.proposalId) {
      return Response.json({ error: "proposalId ist für apply erforderlich." }, { status: 400 });
    }
    return postApplyProposal({
      runId: parsedParams.data.runId,
      proposalId: body.proposalId,
      editedContent: body.editedContent,
      ideaTitle: body.ideaTitle,
    });
  }

  return Response.json({ error: "Unbekannte Aktion." }, { status: 400 });
}
