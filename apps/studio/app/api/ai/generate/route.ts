import { postGenerate } from "../../../../src/lib/ai-handlers";
import type { AiProviderId, AiTaskType } from "@uwe/ai-brain";
import { requireStudioApiAuth } from "../../../../src/lib/studio-api-auth";

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as {
    taskType: AiTaskType;
    worldSlug: string;
    pageSlug: string;
    providerId: AiProviderId;
    model: string;
    userPrompt?: string;
    allowDmOnly?: boolean;
    sessionId?: string;
    useMock?: boolean;
    discardProposalId?: string;
  };

  if (!body.taskType || !body.worldSlug || !body.pageSlug || !body.providerId || !body.model) {
    return Response.json(
      { error: "taskType, worldSlug, pageSlug, providerId und model sind erforderlich." },
      { status: 400 },
    );
  }

  return postGenerate(body);
}
