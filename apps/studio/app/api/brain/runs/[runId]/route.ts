import {
  getBrainRunById,
  postApplyProposal,
  postDiscardRun,
} from "../../../../../src/lib/brain-handlers";
import { requireStudioApiAuth } from "../../../../../src/lib/studio-api-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { runId } = await context.params;
  return getBrainRunById(runId);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { runId } = await context.params;
  const body = (await request.json()) as {
    action: "apply" | "discard";
    proposalId?: string;
    editedContent?: string;
    ideaTitle?: string;
  };

  if (body.action === "discard") {
    return postDiscardRun(runId);
  }

  if (body.action === "apply") {
    if (!body.proposalId) {
      return Response.json({ error: "proposalId ist für apply erforderlich." }, { status: 400 });
    }
    return postApplyProposal({
      runId,
      proposalId: body.proposalId,
      editedContent: body.editedContent,
      ideaTitle: body.ideaTitle,
    });
  }

  return Response.json({ error: "Unbekannte Aktion." }, { status: 400 });
}
