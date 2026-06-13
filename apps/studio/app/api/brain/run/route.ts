import { postBrainRun } from "../../../../src/lib/brain-handlers";
import type { AiProviderId } from "@uwe/ai-brain";
import { requireStudioApiAuth } from "../../../../src/lib/studio-api-auth";

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as {
    actionId: string;
    worldSlug: string;
    pageSlug: string;
    providerId: AiProviderId;
    model: string;
    userPrompt?: string;
    sessionId?: string;
    allowDmOnly?: boolean;
    useMock?: boolean;
  };

  if (!body.actionId || !body.worldSlug || !body.pageSlug || !body.providerId || !body.model) {
    return Response.json(
      { error: "actionId, worldSlug, pageSlug, providerId und model sind erforderlich." },
      { status: 400 },
    );
  }

  return postBrainRun(body);
}
